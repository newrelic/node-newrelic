/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Sampler = require('./sampler')

class AlwaysOnSampler extends Sampler {
  applySamplingDecision({ transaction, partialType }) {
    if (!transaction) return
    transaction.partialType = partialType
    transaction.priority = partialType ? 2.0 : 3.0
    transaction.sampled = true
  }
}

module.exports = AlwaysOnSampler
