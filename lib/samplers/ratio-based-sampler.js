/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Sampler = require('./sampler')

/**
 * Trace ID ratio-based sampler adapted for New Relic agent use,
 * based on OpenTelemetry's sampler of the same name.
 */
class TraceIdRatioBasedSampler extends Sampler {
  /**
   * @param {object} opts Sampler options.
   * @param {number} opts.ratio - The sampling ratio (0 to 1).
   */
  constructor(opts) {
    super() // no-op
    this._ratio = this._normalize(opts.ratio)
    this._upperBound = Math.floor(this._ratio * 0xffffffff)
  }

  applySamplingDecision({ transaction, partialType }) {
    if (!transaction) return
    transaction.partialType = partialType
    const initPriority = Sampler.generatePriority()
    transaction.sampled = this.shouldSample(transaction.traceId)
    transaction.priority = transaction.sampled ? Sampler.incrementPriority(initPriority, partialType) : initPriority
  }

  /**
   *
   * @param {string} traceId transaction trace id
   * @returns {boolean} whether to sample a transaction based on given trace id
   */
  shouldSample(traceId) {
    const accumulated = this._accumulate(traceId)
    return accumulated <= this._upperBound
  }

  /**
   * Normalizes the sampling ratio.
   * @param {number} ratio The ratio provided by the config, granted it is a number.
   * @returns {number} The normalized ratio [0, 1].
   */
  _normalize(ratio) {
    if (typeof ratio !== 'number' || isNaN(ratio)) {
      return 0
    }
    if (ratio >= 1) return 1
    if (ratio <= 0) return 0
    return ratio
  }

  /**
   * Accumulates a value from the trace ID.
   * @param {string} traceId The trace ID to accumulate.
   * @returns {number} The accumulated value.
   */
  _accumulate(traceId) {
    let accumulation = 0
    for (let i = 0; i < traceId.length / 8; i++) {
      const pos = i * 8
      const part = parseInt(traceId.slice(pos, pos + 8), 16)
      accumulation = (accumulation ^ part) >>> 0
    }
    return accumulation
  }
}

module.exports = TraceIdRatioBasedSampler
