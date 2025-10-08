/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class AdaptiveSampler {
  constructor(opts) {
    this._serverless = opts.serverless
    this._seen = 0
    this._sampled = 0
    this._samplingPeriod = 0
    this._samplingTarget = opts.target
    this._maxSamples = 2 * opts.target
    this._samplingThreshold = 0
    this._resetCount = 0
    this._resetInterval = null

    this.samplingPeriod = opts.period

    if (this._serverless) {
      this._windowStart = null
      opts.agent.on('transactionStarted', this.maybeUpdateWindow.bind(this))
    }
  }

  get sampled() {
    return this._sampled
  }

  get samplingThreshold() {
    return this._samplingThreshold
  }

  get samplingTarget() {
    return this._samplingTarget
  }

  set samplingTarget(target) {
    this._samplingTarget = target
    this._maxSamples = 2 * target
    this._adjustStats(this._samplingTarget)
  }

  get samplingPeriod() {
    return this._samplingPeriod
  }

  set samplingPeriod(period) {
    this._samplingPeriod = period
    if (!this._serverless) {
      clearInterval(this._resetInterval)

      if (period) {
        this._resetInterval = setInterval(() => this._reset(), period)
        this._resetInterval.unref()
      }
    }
  }

  /**
   *  Used to determine if the sampling window should be reset based on the start time
   *  of the provided transaction.
   *
   *  @param {object} transaction - The transaction to compare against the current
   *                                window.
   */
  maybeUpdateWindow(transaction) {
    const timestamp = transaction.timer.start
    if (!this._windowStart || timestamp - this._windowStart >= this._samplingPeriod) {
      this._windowStart = timestamp
      this._reset()
    }
  }

  /**
   * Determines if an object should be sampled based on the object's priority and
   * the number of objects sampled in this window.
   *
   * @param {number} roll - The number to compare against the threshold
   * @returns {boolean} True if the object should be sampled.
   */
  shouldSample(roll) {
    ++this._seen
    if (roll >= this._samplingThreshold) {
      this._incrementSampled()
      return true
    }

    return false
  }

  /**
   * Starts a new sample period after adjusting the sampling statistics.
   */
  _reset() {
    ++this._resetCount
    this._adjustStats(this._samplingTarget)

    this._seen = 0
    this._sampled = 0
  }

  /**
   * Increments the sampled counter and adjusted the sampling threshold to maintain
   * a steady sample rate.
   */
  _incrementSampled() {
    if (++this._sampled >= this._samplingTarget) {
      // For the first sample window we take the first 10 transactions and only
      // the first 10.
      let adjustedTarget = 0
      if (this._resetCount > 0) {
        const target = this._samplingTarget
        const ratio = target / this._sampled
        const max = target / this._maxSamples
        adjustedTarget = Math.pow(target, ratio) - Math.pow(target, max)
      }
      this._adjustStats(adjustedTarget)
    }
  }

  /**
   * Adjusts the statistics used to determine if an object should be sampled.
   *
   * @param {number} target - The target number of objects to sample.
   */
  _adjustStats(target) {
    if (this._seen) {
      const ratio = Math.min(target / this._seen, 1)
      this._samplingThreshold = 1 - ratio
    }
  }
}

module.exports = AdaptiveSampler
