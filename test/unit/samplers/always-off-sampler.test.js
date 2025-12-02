/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const AlwaysOffSampler = require('#agentlib/samplers/always-off-sampler.js')

test.beforeEach((ctx) => {
  const sampler = new AlwaysOffSampler()
  ctx.nr = { sampler }
})

test('AlwaysOffSampler should always sample', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, isFullTrace: true })
  assert.equal(transaction.sampled, false)
  assert.equal(transaction.priority, 0)
  assert.equal(transaction.isPartialTrace, false)
})

test('AlwaysOffSampler should assign isPartialTrace to true when not a fullTrace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, isFullTrace: false })
  assert.equal(transaction.sampled, false)
  assert.equal(transaction.priority, 0)
  assert.equal(transaction.isPartialTrace, true)
})

test('AlwaysOffSampler should return null when transaction is not provided', (t) => {
  const { sampler } = t.nr
  assert.doesNotThrow(() => {
    sampler.applySamplingDecision({ transaction: null, isFullTrace: true })
  })
})
