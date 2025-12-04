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
}

module.exports = Sampler
