/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../../logger').child({ component: 'Transaction Trace Aggregator' })

/*
 *
 * CONSTANTS
 *
 */
const TO_MILLIS = 1e3
const TraceAggregator = require('../../aggregators/trace-aggregator')

/**
 * Locus for the complicated logic surrounding the selection of slow
 * transaction traces for submission to the collector.
 *
 * @param {object} config Dictionary containing transaction tracing
 *                        parameters. Required.
 */
class TransactionTraceAggregator extends TraceAggregator {
  constructor(opts, collector) {
    opts = opts || {}
    opts.method = opts.method || 'trace_sample_data'
    if (!opts.config) {
      throw new Error('config required by trace aggregator')
    }

    super(opts, collector)
    /*
     * From
     *
     * https://newrelic.atlassian.net/wiki/display/eng/Transaction+Trace+Collection+Improvements
     *
     * 5 Transaction Trace Guarantee
     *
     * For the initial experience problem, the Agent will sample up to 1
     * transaction per minute until it has sampled 5 transactions. This
     * guarantees that the agent will always report some transaction traces.
     * There is no time out for this sampling period - the agent always
     * samples until it has collected 5 transactions. The agent doesn't
     * simply report the first 5 transactions that it sees because it's
     * likely (particularly for a local dev test) that all 5 transactions
     * would be associated with one request (a single web page and its
     * resources).
     */

    const config = opts.config
    this.reported = 0
    this.config = config

    // Setting up top n capacity.
    this.capacity = 1
    if (config.transaction_tracer && config.transaction_tracer.top_n) {
      this.capacity = config.transaction_tracer.top_n
    }

    // hidden class optimization
    this.trace = null
    this.syntheticsTraces = []
    this.requestTimes = Object.create(null)
    this.noTraceSubmitted = 0
  }

  /**
   * For every five harvest cycles (or "minutes"), if no new slow transactions
   * have been added, reset the requestTime match and allow a new set of five
   * to start populating the Top N Slow Trace list.
   */
  resetTimingTracker() {
    this.requestTimes = Object.create(null)
    this.noTraceSubmitted = 0
  }

  /**
   * Add a trace to the slow trace list, if and only if it fulfills the necessary
   * criteria.
   *
   * @param {Transaction} transaction The transaction, which we need to check
   *                                  apdexT, as well as getting the trace.
   */
  add(transaction) {
    if (!transaction) {
      return
    }

    if (
      this.config.collect_traces &&
      this.config.transaction_tracer &&
      this.config.transaction_tracer.enabled &&
      transaction &&
      transaction.metrics
    ) {
      const trace = transaction.trace
      const name = transaction.getFullName()
      const duration = trace.getDurationInMillis()
      const apdexT = transaction.metrics.apdexT

      if (transaction.syntheticsData) {
        this.addSyntheticsTrace(trace)
      } else if (this.isBetter(name, duration, apdexT)) {
        this.trace = trace

        // because of the "first 5" rule, this may or may not be the slowest
        if (!this.requestTimes[name] || this.requestTimes[name] < duration) {
          this.requestTimes[name] = duration
        }
      }
    }
  }

  addSyntheticsTrace(trace) {
    if (this.syntheticsTraces.length < 20) {
      this.syntheticsTraces.push(trace)
      return true
    }
    return false
  }

  /**
   * Reset the trace diversity settings.
   */
  clear() {
    this.trace = null
    this.syntheticsTraces = []
  }

  _merge(data) {
    if (!data) {
      return
    }
    if (data.trace) {
      this.add(data.trace.transaction)
    }
    if (data.synthetics) {
      for (let i = 0; i < data.synthetics.length; ++i) {
        const trace = data.synthetics[i]
        if (!this.addSyntheticsTrace(trace)) {
          break
        }
      }
    }
  }

  _getMergeData() {
    return {
      trace: this.trace,
      synthetics: this.synthetricsTraces
    }
  }

  getTraces() {
    const traces = [].concat(this.syntheticsTraces)
    const maxTraceSegments = this.config.max_trace_segments
    if (this.trace) {
      const trace = this.trace
      if (trace.segmentsSeen > maxTraceSegments) {
        logger.warn(
          'Transaction %s (%s) contained %d segments, only collecting the first %d',
          trace.transaction.name,
          trace.transaction.id,
          trace.segmentsSeen,
          maxTraceSegments
        )
      }
      this.noTraceSubmitted = 0
      traces.push(trace)
    } else if (++this.noTraceSubmitted >= 5) {
      this.resetTimingTracker()
    }
    return traces.length === 0 ? null : traces
  }

  _toPayloadSync() {
    const traces = this.getTraces()
    if (!traces) {
      logger.debug('No transaction traces to send.')
      return null
    }

    return [this.runId, traces.map((trace) => trace.generateJSONSync())]
  }

  async _toPayload(callback) {
    const traces = this.getTraces()
    if (!traces) {
      return callback(null, traces)
    }

    const tracePromises = traces.map((trace) => {
      return new Promise((resolve, reject) => {
        trace.generateJSON((err, data) => {
          if (err) {
            reject(err)
          }
          resolve(data)
        })
      })
    })

    try {
      const encodedTraces = await Promise.all(tracePromises)
      callback(null, [this.runId, encodedTraces])
    } catch (err) {
      callback(err)
    }
  }

  _afterSend(successful) {
    if (successful) {
      ++this.reported
    }
  }

  /**
   * Determine whether a new trace is more worth keeping than an old one.
   * This gets called on every single transactionFinished event, so return as
   * quickly as possible and call as few external functions as possible. On the
   * converse, there's some complicated logic here, so spell things out.
   *
   * All specifications are from
   * https://newrelic.atlassian.net/wiki/display/eng/Transaction+Trace+Collection+Improvements
   *
   * @param {string} name     Name of this transaction's key metric.
   * @param {number} duration Time the transaction took, in milliseconds.
   * @param {number} apdexT   Apdex tolerating threshold, in seconds.
   */
  isBetter(name, duration, apdexT) {
    /* 1. If the transaction duration is below the tracing threshold, the
     *    transaction is skipped.
     *
     * The threshold for slow traces defaults to apdex_f, which is 4 * apdex_t.
     */
    const config = this.config.transaction_tracer
    let isOverThreshold

    if (
      config &&
      config.transaction_threshold != null &&
      config.transaction_threshold !== 'apdex_f' &&
      typeof config.transaction_threshold === 'number'
    ) {
      isOverThreshold = duration >= config.transaction_threshold * TO_MILLIS
    } else {
      isOverThreshold = duration >= 4 * TO_MILLIS * apdexT
    }
    if (!isOverThreshold) {
      return false
    }

    /* 2. If the transaction duration is less than the duration of the current
     *    slow transaction, the transaction is skipped.
     */
    let slowerThanExisting = true
    if (this.trace) {
      slowerThanExisting = this.trace.getDurationInMillis() < duration
    }
    if (!slowerThanExisting) {
      return false
    }

    /* We always gather some slow transactions at the start, regardless of
     * the size of Top N. This changes the behavior of the rest of the
     * decision-making process in some subtle ways.
     */
    const hasMetGuarantee = this.reported >= 5

    /* 3. If the transaction's name is in the transaction map and its duration
     *    is less than the response time in the map, it is skipped.
     */
    let slowerThanCaptured = true
    if (hasMetGuarantee && this.requestTimes[name]) {
      slowerThanCaptured = this.requestTimes[name] < duration
    }
    if (!slowerThanCaptured) {
      return false
    }

    /* Not part of enumerated rules, but necessary for Top N support:
     * Ensure this name is either already in the request time map
     * or that the map still hasn't hit capacity.
     */
    return !(
      hasMetGuarantee &&
      !this.requestTimes[name] &&
      Object.keys(this.requestTimes).length >= this.capacity
    )
  }
}

module.exports = TransactionTraceAggregator
