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
  /**
   * Sets `priority` and `sampled` on the transaction
   * in respect to this sampler's decision.
   * Depending on the sampler, it could use `tracestate` to make its decision.
   * All samplers will use `isFullTrace` to at the very least set `transaction.isPartialTrace`.
   *
   * @param {object} params to function
   * @param {Transaction} params.transaction the transaction to update
   * @param {string} params.tracestate the tracestate header value
   * @param {boolean} params.isFullTrace whether or not full tracing is enabled
   */
  applySamplingDecision({ transaction, tracestate, isFullTrace }) {
    const formattedError = util.format('must implement applySamplingDecision, arguments are: { transaction: %d, tracestate: %s, isFullTrace: %s}', transaction?.id, tracestate, isFullTrace)
    throw new Error(formattedError)
  }
}

module.exports = Sampler
