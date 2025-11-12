/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Trace ID ratio-based sampler adapted for New Relic agent use,
 * based on OpenTelemetry's sampler of the same name.
 */
class TraceIdRatioBasedSampler {
  /**
   * @param {object} opts Sampler options.
   * @param {Agent} opts.agent - The New Relic agent instance.
   * @param {number} opts.ratio - The sampling ratio (0 to 1).
   */
  constructor(opts) {
    if (!opts.ratio) {
      opts.agent.logger.error('trace_id_ratio_based sampler configured without a ratio value')
      throw new Error('ratio is required for TraceIdRatioBasedSampler')
    }
    this._ratio = this._normalize(opts.ratio)
    this._upperBound = Math.floor(this._ratio * 0xffffffff)

    // TODO: serverless support??
  }

  shouldSample(traceId) {
    const accumulated = this._accumulate(traceId)
    return accumulated <= this._upperBound
  }

  /**
   * Normalizes the sampling ratio.
   * @param {number} ratio The ratio provided by the config.
   * @returns {number} The normalized ratio [0, 1].
   */
  _normalize(ratio) {
    if (typeof ratio !== 'number' || isNaN(ratio)) return 0
    if (ratio >= 1) return 1

    return ratio <= 0 ? 0 : ratio
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
