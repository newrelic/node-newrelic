'use strict'

var a = require('async')
var logger = require('../logger').child({component: 'query_tracer'})
var obfuscate = require('../util/sql/obfuscate')
var Stats = require('../stats')
var util = require('util')
var crypto = require('crypto')
var encode = require('../util/codec').encode
var path = require('path')

var NR_ROOT = path.resolve(__dirname, '..')

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
  if (segment.getDurationInMillis() < ttConfig.explain_threshold) {
    return
  }
  const slowQuery = new SlowQuery(segment, type, query, trace)

  switch (ttConfig.record_sql) {
    case 'raw':
      logger.trace('recording raw sql')
      segment.parameters.sql = slowQuery.query
      break
    case 'obfuscated':
      logger.trace('recording obfuscated sql')
      segment.parameters.sql_obfuscated = slowQuery.obfuscated
      break
    default:
      logger.trace(
        'not collecting slow-query because transaction_tracer.record_sql was set to %s',
        ttConfig.record_sql
      )
      return
  }
  segment.parameters.backtrace = slowQuery.trace

  if (!this.config.slow_sql.enabled) {
    return
  }

  const ownSample = this.samples.get(slowQuery.normalized)
  if (ownSample) {
    return ownSample.aggregate(slowQuery)
  }

  this.samples.set(slowQuery.normalized, new QuerySample(this, slowQuery))
  if (this.samples.size > this.config.slow_sql.max_samples) {
    this.removeShortest()
  }
}

QueryTracer.prototype.prepareJSON = function prepareJSON(done) {
  a.map(this.samples.values(), (sample, cb) => sample.prepareJSON(cb), done)
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
    encode(params, respond)
  } else {
    process.nextTick(respond.bind(null, null, params))
  }

  function respond(err, data) {
    if (err) return done(err)

    done(null, [
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
    ])
  }
}

QuerySample.prototype.getParams = function getParams() {
  var segmentParams = this.trace.segment.parameters
  var params = {
    backtrace: this.trace.trace,
  }

  if (segmentParams.host) {
    params.host = segmentParams.host
  }

  if (segmentParams.port_path_or_id) {
    params.port_path_or_id = segmentParams.port_path_or_id
  }

  if (segmentParams.database_name) {
    params.database_name = segmentParams.database_name
  }

  if (this.tracer.config.feature_flag.distributed_tracing) {
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
  return parseInt(crypto.createHash('md5').update(value).digest('hex').slice(-4), 16)
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
