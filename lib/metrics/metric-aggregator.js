/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'metric-aggregator' })
const Aggregator = require('../aggregators/base-aggregator')
const Metrics = require('../metrics')

const FROM_MILLIS = 1e-3

class MetricAggregator extends Aggregator {
  constructor(opts, collector) {
    _isValidOrThrow(opts)

    opts.method = opts.method || 'metric_data'

    super(opts, collector)

    this._apdexT = opts.apdexT
    this._mapper = opts.mapper
    this._normalizer = opts.normalizer

    this._metrics = new Metrics(this._apdexT, this._mapper, this._normalizer)
  }

  get empty() {
    return this._metrics.empty
  }

  get started() {
    return this._metrics.started
  }

  _toPayloadSync() {
    if (this._metrics.empty) {
      logger.debug('No metrics to send.')
      return
    }

    const beginSeconds = this._metrics.started * FROM_MILLIS
    const endSeconds = Date.now() * FROM_MILLIS

    return [this.runId, beginSeconds, endSeconds, this._metrics.toJSON()]
  }

  _getMergeData() {
    return this._metrics
  }

  _merge(metrics) {
    if (!metrics) {
      return
    }

    // Adjust start when merging due to server round-trip
    this.merge(metrics, true)
  }

  merge(metrics, adjustStartTime) {
    this._metrics.merge(metrics, adjustStartTime)
  }

  clear() {
    this._metrics = new Metrics(this._apdexT, this._mapper, this._normalizer)
  }

  /**
   * Look up the mapping from a name (and optionally a scope) to a set of metric
   * data for that name, creating the data if they don't already exist.
   *
   * @param {string} name The name of the requested metric.
   * @param {string} scope (Optional) The scope to which the metric is bound.
   * @returns {Stats} The aggregated data for that name.
   */
  getOrCreateMetric(name, scope) {
    return this._metrics.getOrCreateMetric(name, scope)
  }

  /**
   * This is the preferred way for interacting with metrics. Set the duration
   * (and optionally the amount of that duration that was exclusive to that
   * particular metric and not any child operations to that metric) of an
   * operation. If there are no data for the name (and optional scope) existing,
   * the collection will create a set of data before recording the measurement.
   *
   * @param {string} name The name of the metric.
   * @param {string} scope (Optional) The scope to which the metric belongs.
   * @param {number} duration The duration of the related operation, in milliseconds.
   * @param {number} exclusive (Optional) The portion of the operation specific to this
   *                           metric.
   * @returns {Stats} The aggregated data related to this metric.
   */
  measureMilliseconds(name, scope, duration, exclusive) {
    return this._metrics.measureMilliseconds(name, scope, duration, exclusive)
  }

  /**
   * Set the size of an operation. If there are no data for the name existing,
   * the collection will create a set of data before recording the measurement.
   * If data do exist for the given name, the value will be incremented by the
   * given size. Use `exclusiveSize` to set the size of this specific operation,
   * if it is different from the overall size of the operation.
   *
   * @param {string} name The name of the metric.
   * @param {number} size The size of the related operation, in megabytes.
   * @param {number} exclusiveSize The exclusive size of the related operation, in megabytes.
   * @param {boolean} exact If true, size is interpreted as bytes rather than megabytes
   * @returns {Stats} The aggregated data related to this metric.
   */
  measureBytes(name, size, exclusiveSize, exact) {
    return this._metrics.measureBytes(name, size, exclusiveSize, exact)
  }

  /**
   * Look up a metric, and don't create it if it doesn't exist. Can create scopes
   * as a byproduct, but this function is only intended for use in testing, so
   * it's not a big deal.
   *
   * @param {string} name Metric name.
   * @param {string} scope (Optional) The scope, if any, to which the metric
   *                       belongs.
   * @returns {object} Either a stats aggregate, an apdex stats aggregate, or
   *                  undefined.
   */
  getMetric(name, scope) {
    return this._metrics.getMetric(name, scope)
  }

  /**
   * Look up the mapping from a name (and optionally a scope) to a set of metric
   * apdex data for that name, creating the data if they don't already exist.
   *
   * @param {string} name          The name of the requested metric.
   * @param {string} scope         The scope to which the metric is bound
   *                               (optional).
   * @param {number} overrideApdex A custom apdexT for this metric, in
   *                               milliseconds. This will be the same for
   *                               a given run, because key transaction metrics
   *                               are set at connect time via server-side
   *                               configuration.
   * @returns {ApdexStats} The aggregated data for that name.
   */
  getOrCreateApdexMetric(name, scope, overrideApdex) {
    return this._metrics.getOrCreateApdexMetric(name, scope, overrideApdex)
  }

  reconfigure(config) {
    super.reconfigure(config)

    this._apdexT = config.apdex_t
    this._metrics.apdexT = this._apdexT
  }
}

function _isValidOrThrow(opts) {
  if (!opts) {
    throw new Error('Metric aggregator must be created with options.')
  }

  if (opts.apdexT == null || opts.apdexT === '') {
    throw new Error('Metric aggregator must be created with apdexT')
  }

  if (!opts.mapper) {
    throw new Error('Metric aggregator must be created with a mapper')
  }

  if (!opts.normalizer) {
    throw new Error('Metric aggregator must be created with a name normalizer')
  }
}

module.exports = MetricAggregator
