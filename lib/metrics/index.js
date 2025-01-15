/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Stats = require('../stats')
const ApdexStats = require('../stats/apdex.js')
const NAMES = require('./names')

/*
 *
 * CONSTANTS
 *
 */
const FROM_MILLIS = 1e-3

/**
 * A metric is a set of aggregated data (summary statistics) associated with a
 * metric name. Some metrics belong to scopes, which are typically the name of
 * a transaction or a background task. This class is a collection of mappings
 * from names (or scopes and names) to data, as well as functions for
 * manipulating those data directly. It also can produce a serialized
 * representation suitable for stringifying into JSON and sending to the
 * collector.
 *
 * There are several metrics collections in existence at any given time. Each
 * agent has one metrics collection, which is created at the beginning of each
 * harvest cycle. Each new transaction also gets its own metrics collection,
 * which is merged into the agent's metrics when the transaction is finalized.
 * This allows each set of metrics to be added to the harvest cycle atomically,
 * which guarantees that each transaction will not have its metrics split
 * across multiple harvest cycles. If delivery to the collector fails, the
 * metrics collection associated with the failed delivery can be merged back
 * into the metrics collection for the ongoing harvest cycle.
 *
 * Metrics can be remapped, which is a process by which they are assigned a
 * short, numerical ID by New Relic. This can shrink the serialized JSON
 * considerably. The mapping from transaction name (and scope) happens only
 * at serialization time, which allows the mappings from name to ID to happen
 * on the fly.
 *
 * @param {number} apdexT The apdex-tolerating value, for use in creating apdex
 *                        statistics.
 * @param {MetricMapper} mapper The mapper that turns metric names into IDs.
 * @param normalizer
 */
function Metrics(apdexT, mapper, normalizer) {
  if (apdexT == null || apdexT === '') {
    throw new Error('metrics must be created with apdexT')
  }
  if (!mapper) {
    throw new Error('metrics must be created with a mapper')
  }
  if (!normalizer) {
    throw new Error('metrics must be created with a name normalizer')
  }

  this.empty = true
  this.started = Date.now()
  this.apdexT = apdexT
  this.mapper = mapper
  this.normalizer = normalizer
  this.unscoped = Object.create(null) // {name : stats}
  this.scoped = Object.create(null) // {scope : {name : stats}}
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
Metrics.prototype.measureMilliseconds = measureMilliseconds

function measureMilliseconds(name, scope, duration, exclusive) {
  const stats = this.getOrCreateMetric(name, scope)
  stats.recordValueInMillis(duration, exclusive)
  return stats
}

/**
 * Set the size of an operation. If there are no data for the name existing,
 * the collection will create a set of data before recording the measurement.
 *
 * @param {string} name The name of the metric.
 * @param {number} size The size of the related operation, in bytes.
 * @param {number} exclusiveSize The exclusive size of the related operation, in megabytes.
 * @param {boolean} exact If true, size is interpreted as bytes rather than megabytes
 * @returns {Stats} The aggregated data related to this metric.
 */
Metrics.prototype.measureBytes = function measureBytes(name, size, exclusiveSize, exact) {
  const stats = this.getOrCreateMetric(name)
  stats.recordValueInBytes(size, exclusiveSize, exact)
  return stats
}

/**
 * Look up the mapping from a name (and optionally a scope) to a set of metric
 * data for that name, creating the data if they don't already exist.
 *
 * @param {string} name The name of the requested metric.
 * @param {string} scope (Optional) The scope to which the metric is bound.
 * @returns {Stats} The aggregated data for that name.
 */
Metrics.prototype.getOrCreateMetric = function getOrCreateMetric(name, scope) {
  const resolved = this._resolve(scope)
  let stats = resolved[name]
  if (!stats) {
    this.empty = false
    stats = resolved[name] = new Stats()
  }
  return stats
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
Metrics.prototype.getOrCreateApdexMetric = getOrCreateApdexMetric

function getOrCreateApdexMetric(name, scope, overrideApdex) {
  if (!name) {
    throw new Error('Metrics must be named')
  }

  const resolved = this._resolve(scope)

  if (!resolved[name]) {
    this.empty = false

    // Only use the given override to create the metric if this is not the
    // global apdex AND we have a valid value.
    const apdexT =
      name !== NAMES.APDEX && overrideApdex > 0 ? overrideApdex * FROM_MILLIS : this.apdexT
    resolved[name] = new ApdexStats(apdexT)
  }
  return resolved[name]
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
Metrics.prototype.getMetric = function getMetric(name, scope) {
  if (!name) {
    throw new Error('Metrics must be named')
  }

  return this._resolve(scope)[name]
}

/**
 * Convert this collection into a representation suitable for serialization
 * by JSON.stringify and delivery to the collector. Hope you like nested
 * arrays!
 *
 * @returns {object} Set of nested arrays containing metric information.
 */
Metrics.prototype.toJSON = function toJSON() {
  return this._toUnscopedData().concat(this._toScopedData())
}

/**
 * Combine two sets of metric data. Intended to be used as described above,
 * either when folding a transaction's metrics into the agent's metrics for
 * later harvest, or one harvest cycle's metrics into the next when a
 * delivery attempt to the collector fails. Among the more performance-
 * critical pieces of code in the agent, so some performance tuning would
 * probably be a good idea.
 *
 * @param {Metrics} other
 *  The collection to be folded into this one.
 * @param {boolean} adjustStartTime
 *  If the start time for the timeslice should be adjusted.
 */
Metrics.prototype.merge = function merge(other, adjustStartTime) {
  this.empty = this.empty && other.empty
  if (adjustStartTime) {
    this.started = Math.min(this.started, other.started)
  }
  _merge(this.unscoped, other.unscoped)

  // Loop through all scopes and merge them. Since we know `.scoped` has a `null`
  // prototype we don't need to worry about own property checks.
  for (const scope in other.scoped) {
    _merge(this._resolve(scope), other.scoped[scope])
  }
}
function _merge(a, b) {
  for (const name in b) {
    if (a[name]) {
      a[name].merge(b[name])
    } else {
      a[name] = b[name]
    }
  }
}

/**
 * Look up the metric namespace belonging to a scope, creating it if it doesn't
 * already exist.
 *
 * @param {string} scope (Optional) The scope to look up.
 * @returns {object} The namespace associated with the provided scope, or the
 *                  un-scoped metrics if the scope isn't set.
 */
Metrics.prototype._resolve = function _resolve(scope) {
  let resolved = this.unscoped

  if (scope) {
    resolved = this.scoped[scope]
    if (!resolved) {
      resolved = this.scoped[scope] = Object.create(null)
    }
  }

  return resolved
}

/**
 * Map a metric to its nested-array representation, applying any name -> ID
 * mappings along the way. Split from _getScopedData for performance.
 *
 * @param {string} name The string to look up.
 */
Metrics.prototype._getUnscopedData = function _getUnscopedData(name) {
  if (!this.unscoped[name]) {
    return
  }

  const normalized = this.normalizer.normalize(name)
  if (normalized.ignore || !normalized.value) {
    return
  }

  return [this.mapper.map(normalized.value), this.unscoped[name]]
}

/**
 * Map a metric to its nested-array representation, applying any name -> ID
 * mappings along the way. Split from _getUnscopedData for performance.
 *
 * @param {string} name The string to look up.
 * @param scope
 */
Metrics.prototype._getScopedData = function _getScopedData(name, scope) {
  if (!this.scoped[scope][name]) {
    return
  }

  const normalized = this.normalizer.normalize(name)
  if (normalized.ignore || !normalized.value) {
    return
  }

  return [this.mapper.map(normalized.value, scope), this.scoped[scope][name]]
}

/**
 * @returns {object} A serializable version of the unscoped metrics. Intended
 *                  for use by toJSON.
 */
Metrics.prototype._toUnscopedData = function _toUnscopedData() {
  const metricData = []

  Object.keys(this.unscoped).forEach((name) => {
    const data = this._getUnscopedData(name)
    if (data) {
      metricData.push(data)
    }
  })

  return metricData
}

/**
 * @returns {object} A serializable version of the scoped metrics. Intended for
 *                  use by toJSON.
 */
Metrics.prototype._toScopedData = function _toScopedData() {
  const metricData = []

  Object.keys(this.scoped).forEach(function forEachScope(scope) {
    Object.keys(this.scoped[scope]).forEach(function forEachMetric(name) {
      const data = this._getScopedData(name, scope)
      if (data) {
        metricData.push(data)
      }
    }, this)
  }, this)

  return metricData
}

module.exports = Metrics
