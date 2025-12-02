/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Sampler = require('#agentlib/samplers/sampler.js')

test('should throw error if applySamplingDecision is not implemented', () => {
  const sampler = new Sampler()
  assert.throws(() => {
    sampler.applySamplingDecision({ transaction: { id: 1 }, tracestate: 'tracestate', isFullTrace: true })
  }, /^Error: must implement applySamplingDecision, arguments are: { transaction: 1, tracestate: tracestate, isFullTrace: true/)
})
