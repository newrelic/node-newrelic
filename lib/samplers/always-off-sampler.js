/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
const Sampler = require('./sampler')

class AlwaysOffSampler extends Sampler {
  applySamplingDecision({ transaction, partialType }) {
    if (!transaction) return
    transaction.partialType = partialType
    transaction.priority = 0
    transaction.sampled = false
  }
}

module.exports = AlwaysOffSampler
