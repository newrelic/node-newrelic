/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Sampler = require('./sampler')

class AlwaysOnSampler extends Sampler {
  applySamplingDecision({ transaction, isFullTrace }) {
    if (!transaction) return
    transaction.isPartialTrace = !isFullTrace
    transaction.priority = 2.0
    transaction.sampled = true
  }
}

module.exports = AlwaysOnSampler
