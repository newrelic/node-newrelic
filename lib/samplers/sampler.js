/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
const util = require('node:util')

/**
 * @private
 * @interface
 */
class Sampler {
  get [Symbol.toStringTag]() { return this.constructor.name }

  toString() {
    return this.constructor.name
  }

  /**
   * Sets `priority` and `sampled` on the transaction
   * in respect to this sampler's decision.
   * Depending on the sampler, it could use `tracestate` to make its decision.
   * partialType is passed in when a sampling decision is being made for a partial trace.
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction the transaction to update
   * @param {string} params.tracestate the tracestate header value
   * @param {string|undefined} params.partialType the partial granularity type, if any
   */
  applySamplingDecision({ transaction, tracestate, partialType }) {
    const formattedError = util.format('must implement applySamplingDecision, arguments are: { transaction: %d, tracestate: %s, partialType: %s}', transaction?.id, tracestate, partialType)
    throw new Error(formattedError)
  }

  /**
   * Creates a random priority value between 0 and 1
   * and truncates it to 6 decimal places. It truncates to
   * 6 decimal places to appease the agent specification for priority values.
   * @returns {number} the generated priority
   */
  static generatePriority() {
    // eslint-disable-next-line sonarjs/pseudo-random
    const priority = Math.random()
    return ((priority * 1e6) | 0) / 1e6
  }

  /**
   * Used to increment priority and truncate to 6 decimal places.
   * Full traces are incremented by 2 and partial traces are incremented by 1
   * @param {number} priority the current priority
   * @param {string|null} partialType if a partial trace
   * @returns {number} the incremented priority
   */
  static incrementPriority(priority, partialType) {
    const increment = partialType ? 1 : 2
    const newPriority = priority + increment
    return ((newPriority * 1e6) | 0) / 1e6
  }
}

module.exports = Sampler
