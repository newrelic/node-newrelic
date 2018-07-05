'use strict'

class AdaptiveSampler {
  constructor(opts) {
    this._seen = 0
    this._sampled = 0
    this._samplingPeriod = 0
    this._samplingTarget = opts.target
    this._maxSamples = 2 * opts.target
    this._minSampledPriority = 0
    this._resetCount = 0
    this._resetInterval = null

    this.samplingPeriod = opts.period
  }

  get sampled() {
    return this._sampled
  }

  get minimumPriority() {
    return this._minSampledPriority
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
    clearInterval(this._resetInterval)
    this._samplingPeriod = period

    if (period) {
      this._resetInterval = setInterval(() => this._reset(), period)
      this._resetInterval.unref()
    }
  }

  /**
   * Determins if an object should be sampled based on the object's priority and
   * the number of objects sampled in this window.
   *
   * @param {object} obj          - The object to check for sampleability.
   * @param {number} obj.priority - The priority of this object.
   *
   * @return {bool} True if the object should be sampled.
   */
  shouldSample(obj) {
    ++this._seen
    if (obj.priority >= this._minSampledPriority) {
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
   * Increments the sampled counter and adjusted the minimum priority to maintain
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
      this._minSampledPriority = 1 - ratio
    }
  }
}

module.exports = AdaptiveSampler
