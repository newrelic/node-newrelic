/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const codec = require('../util/codec')
const Stats = require('../stats')
const util = require('util')

function QuerySample(tracer, slowQuery) {
  Stats.call(this)
  this.tracer = tracer
  this.trace = slowQuery
  this.aggregate(slowQuery)
}

util.inherits(QuerySample, Stats)

QuerySample.prototype.aggregate = function aggregate(slowQuery) {
  this.recordValue(slowQuery.duration)
  if (this.trace && this.trace.duration >= slowQuery.duration) {
    return
  }
  this.trace = slowQuery
}

QuerySample.prototype.merge = function merge(sample) {
  Stats.prototype.merge.call(this, sample)
  if (this.trace.duration < sample.trace.duration) {
    this.trace = sample.trace
  }
}

QuerySample.prototype.prepareJSON = function prepareJSON(done) {
  const transaction = this.trace.segment.transaction
  const sample = this
  const trace = sample.trace

  const params = sample.getParams()

  if (!this.tracer.config.simple_compression) {
    codec.encode(params, respond)
  } else {
    process.nextTick(respond.bind(null, null, params))
  }

  function respond(err, data) {
    if (err) {
      return done(err)
    }

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
  const segmentAttrs = this.trace.segment.getAttributes()
  const params = {
    backtrace: this.trace.trace
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

module.exports = QuerySample
