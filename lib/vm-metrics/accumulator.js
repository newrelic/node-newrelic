/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Accumulates a bundle of values from repeated measurements, tracking the
 * running total, minimum, maximum, sum of squares, and count. The field names
 * match the shape consumed by `Stats.prototype.merge`.
 */
class Accumulator {
  constructor() {
    this.reset()
  }

  /**
   * Folds a single measured value into the running aggregate.
   *
   * @param {number} value The value to accumulate.
   */
  add(value) {
    if (this.count === 0) {
      this.min = this.max = value
    } else {
      this.min = Math.min(this.min, value)
      this.max = Math.max(this.max, value)
    }
    this.total += value
    this.sumOfSquares += value * value
    this.count += 1
  }

  /**
   * Resets the aggregate back to its empty state.
   */
  reset() {
    this.total = 0
    this.min = 0
    this.max = 0
    this.sumOfSquares = 0
    this.count = 0
  }
}

module.exports = Accumulator
