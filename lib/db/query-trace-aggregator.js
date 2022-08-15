/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'query_tracer' })
const Aggregator = require('../aggregators/base-aggregator')
const SlowQuery = require('./slow-query')
const QuerySample = require('./query-sample')

class QueryTraceAggregator extends Aggregator {
  constructor(opts, collector) {
    opts = opts || {}
    opts.method = opts.method || 'sql_trace_data'
    if (!opts.config) {
      throw new Error('config required by query trace aggregator')
    }
    super(opts, collector)

    const config = opts.config
    this.samples = new Map()

    this.config = config
  }

  removeShortest() {
    let shortest = null
    for (const sample of this.samples.values()) {
      const trace = sample.trace
      if (!shortest || shortest.duration > trace.duration) {
        shortest = trace
      }
    }

    this.samples.delete(shortest.normalized)
  }

  _merge(samples) {
    for (const sample of samples.values()) {
      const ownSample = this.samples.get(sample.trace.normalized)
      if (ownSample) {
        ownSample.merge(sample)
      } else {
        this.samples.set(sample.trace.normalized, sample)
      }
    }
  }

  add(segment, type, query, trace) {
    const ttConfig = this.config.transaction_tracer

    // If DT is enabled and the segment is part of a sampled transaction
    // (i.e. we are creating a span event for this segment), then we need
    // to collect the sql trace.
    let slowQuery
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

  _toPayload(cb) {
    if (this.samples.size === 0) {
      logger.debug('No query traces to send.')
      return cb(null, null)
    }

    const runId = this.runId

    return this.prepareJSON((err, data) => cb(err, [runId, data]))
  }

  _toPayloadSync() {
    if (this.samples.size > 0) {
      return [this.runId, this.prepareJSONSync()]
    }

    logger.debug('No query traces to send.')
  }

  _getMergeData() {
    return this.samples
  }

  clear() {
    this.samples = new Map()
  }

  async prepareJSON(done) {
    const samplePromises = []
    for (const sample of this.samples.values()) {
      const samplePromise = new Promise((resolve, reject) => {
        sample.prepareJSON((err, data) => {
          if (err) {
            reject(err)
          }
          resolve(data)
        })
      })
      samplePromises.push(samplePromise)
    }

    try {
      const data = await Promise.all(samplePromises)
      done(null, data)
    } catch (err) {
      done(err)
    }
  }

  prepareJSONSync() {
    return Array.from(this.samples.values()).map((sample) => sample.prepareJSONSync())
  }
}

module.exports = QueryTraceAggregator
