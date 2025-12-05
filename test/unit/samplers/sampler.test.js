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
    sampler.applySamplingDecision({ transaction: { id: 1 }, tracestate: 'tracestate', partialType: 'reduced' })
  }, /^Error: must implement applySamplingDecision, arguments are: { transaction: 1, tracestate: tracestate, partialType: reduced/)
})

test('should generate a random priority between 0 and 1 with at most 6 decimal places', () => {
  const priority = Sampler.generatePriority()
  // must cast priority to string to match regex
  assert.match(`${priority}`, /[01]\.\d{1,6}/)
})

test('should increment priority by n and truncate to  6 decimal places', () => {
  const priority = 0.123456789
  const incremented = Sampler.incrementPriority(priority, 2)
  assert.equal(incremented, 2.123456)
})
