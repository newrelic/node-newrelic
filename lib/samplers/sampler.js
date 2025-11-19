/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @private
 * @interface
 */
class Sampler {
  /**
   * Sets `priority` and `sampled` on the transaction
   * in respect to this sampler's decision.
   * @param {object} params to make the sampling decision with
   * @param {Transaction} params.transaction the transaction to update
   */
  applySamplingDecision({ transaction }) {
    throw new Error('must implement applySamplingDecision for %s', transaction)
  }
}

module.exports = Sampler
