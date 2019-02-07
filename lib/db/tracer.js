'use strict'

var a = require('async')
var logger = require('../logger').child({component: 'query_tracer'})
var obfuscate = require('../util/sql/obfuscate')
var Stats = require('../stats')
var util = require('util')
var crypto = require('crypto')
var codec = require('../util/codec')
var path = require('path')

const NR_ROOT = path.resolve(__dirname, '..')

module.exports = QueryTracer

function QueryTracer(config) {
  if (!(this instanceof QueryTracer)) {
    return new QueryTracer(config)
  }
  this.samples = new Map()
  this.config = config
}

QueryTracer.prototype.removeShortest = function removeShortest() {
  let shortest = null
  for (let sample of this.samples.values()) {
    const trace = sample.trace
    if (!shortest || shortest.duration > trace.duration) {
      shortest = trace
    }
  }

  this.samples.delete(shortest.normalized)
}

QueryTracer.prototype.merge = function merge(tracer) {
  for (let sample of tracer.samples.values()) {
    let ownSample = this.samples.get(sample.trace.normalized)
    if (ownSample) {
      ownSample.merge(sample)
    } else {
      this.samples.set(sample.trace.normalized, sample)
    }
  }
}

QueryTracer.prototype.addQuery = function addQuery(segment, type, query, trace) {
  const ttConfig = this.config.transaction_tracer

  // If DT is enabled and the segment is part of a sampled transaction
  // (i.e. we are creating a span event for this segment), then we need
  // to collect the sql trace.
  var slowQuery
  switch (ttConfig.record_sql) {
    case 'raw':
      slowQuery = new SlowQuery(segment, type, query, trace)
      logger.trace('recording raw sql')
      segment.addAttribute('sql', slowQuery.query, true)
      break
    case 'obfuscated':
      slowQuery = new SlowQuery(segment, type, query, trace)
      logger.trace('recording obfuscated sql')
      segment.addAttribute('sql_obfuscated', slowQuery.obfuscated, true)
      break
    default:
      logger.trace(
        'not recording sql statement, transaction_tracer.record_sql was set to %s',
        ttConfig.record_sql
      )
      return
  }

  if (segment.getDurationInMillis() < ttConfig.explain_threshold) {
    return
  }

  slowQuery = slowQuery || new SlowQuery(segment, type, query, trace)

  segment.addAttribute('backtrace', slowQuery.trace)

  if (!this.config.slow_sql.enabled) {
    return
  }

  const ownSample = this.samples.get(slowQuery.normalized)
  if (ownSample) {
    return ownSample.aggregate(slowQuery)
  }

  this.samples.set(slowQuery.normalized, new QuerySample(this, slowQuery))

  // Do not remove the shortest sample when in serverless mode, since
  // sampling is disabled.
  if (this.config.serverless_mode.enabled) {
    return
  }

  if (this.samples.size > this.config.slow_sql.max_samples) {
    this.removeShortest()
  }
}

QueryTracer.prototype.prepareJSON = function prepareJSON(done) {
  a.map(this.samples.values(), (sample, cb) => sample.prepareJSON(cb), done)
}

QueryTracer.prototype.prepareJSONSync = function prepareJSONSync() {
  return Array.from(this.samples.values()).map((sample) => sample.prepareJSONSync())
}

function QuerySample(tracer, slowQuery) {
  Stats.call(this)
  this.tracer = tracer
  this.trace = slowQuery
  this.aggregate(slowQuery)
}

util.inherits(QuerySample, Stats)

QuerySample.prototype.aggregate = function aggregate(slowQuery) {
  this.recordValue(slowQuery.duration)
  if (this.trace && this.trace.duration >= slowQuery.duration) return
  this.trace = slowQuery
}

QuerySample.prototype.merge = function merge(sample) {
  Stats.prototype.merge.call(this, sample)
  if (this.trace.duration < sample.trace.duration) {
    this.trace = sample.trace
  }
}

QuerySample.prototype.prepareJSON = function prepareJSON(done) {
  var transaction = this.trace.segment.transaction
  var sample = this
  var trace = sample.trace

  var params = sample.getParams()
  if (!this.tracer.config.simple_compression) {
    codec.encode(params, respond)
  } else {
    process.nextTick(respond.bind(null, null, params))
  }

  function respond(err, data) {
    if (err) return done(err)

    done(null, _getJSON(sample, trace, transaction, data))
  }
}

QuerySample.prototype.prepareJSONSync = function prepareJSONSync() {
  const transaction = this.trace.segment.transaction
  const sample = this
  const trace = sample.trace

  const params = sample.getParams()
  const data = this.tracer.config.simple_compression ? params : codec.encodeSync(params)
  return _getJSON(sample, trace, transaction, data)
}

function _getJSON(sample, trace, transaction, data) {
  return [
    transaction.getFullName(),
    transaction.url || '<unknown>',
    trace.id,
    getQuery(sample.tracer.config, trace),
    trace.metric,
    sample.callCount,
    sample.total,
    sample.min,
    sample.max,
    data
  ]
}

QuerySample.prototype.getParams = function getParams() {
  var segmentAttrs = this.trace.segment.getAttributes()
  var params = {
    backtrace: this.trace.trace,
  }

  if (segmentAttrs.host) {
    params.host = segmentAttrs.host
  }

  if (segmentAttrs.port_path_or_id) {
    params.port_path_or_id = segmentAttrs.port_path_or_id
  }

  if (segmentAttrs.database_name) {
    params.database_name = segmentAttrs.database_name
  }

  if (this.tracer.config.distributed_tracing.enabled) {
    this.trace.segment.transaction.addDistributedTraceIntrinsics(params)
  }

  return params
}

function SlowQuery(segment, type, query, trace) {
  this.obfuscated = obfuscate(query, type)
  this.normalized = this.obfuscated.replace(/\?\s*,\s*|\s*/g, '')
  this.id = normalizedHash(this.normalized)
  this.segment = segment
  this.query = query
  this.metric = segment.name
  this.trace = formatTrace(trace)
  this.duration = segment.getDurationInMillis()
}

function normalizedHash(value) {
  // We leverage the last 16 hex digits of which would mostly fit in a long and
  // rely on parseInt to drop bits that do not fit in a JS number
  return parseInt(crypto.createHash('sha1').update(value).digest('hex').slice(-16), 16)
}

function formatTrace(trace) {
  // remove error message and instrumentation frames from stack trace
  return trace ? trace.split('\n').slice(1).filter(notNR).join('\n') : ''
}

function notNR(frame) {
  return frame.indexOf(NR_ROOT) === -1
}

function getQuery(config, trace) {
  switch (config.transaction_tracer.record_sql) {
    case 'raw':
      return trace.query
    case 'obfuscated':
      return trace.obfuscated
    default:
      return '?'
  }
}
