/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const AlwaysOnSampler = require('#agentlib/samplers/always-on-sampler.js')
const { PARTIAL_TYPES } = require('#agentlib/transaction/index.js')

test.beforeEach((ctx) => {
  const sampler = new AlwaysOnSampler()
  ctx.nr = { sampler }
})

test('should set toString and Object.prototype.toString correctly', (t) => {
  const { sampler } = t.nr
  assert.equal(sampler.toString(), 'AlwaysOnSampler')
  assert.equal(Object.prototype.toString.call(sampler), '[object AlwaysOnSampler]')
})

test('AlwaysOnSampler should always sample with priority set to 3 in a full trace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction })
  assert.equal(transaction.sampled, true)
  assert.equal(transaction.priority, 3)
  assert.equal(transaction.partialType, undefined)
})

test('AlwaysOnSampler should always sample with priority set to 2 in a partial trace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, partialType: PARTIAL_TYPES.ESSENTIAL })
  assert.equal(transaction.sampled, true)
  assert.equal(transaction.priority, 2)
  assert.equal(transaction.partialType, 'essential')
})

test('AlwaysOnSampler should assign partialType to true when not a fullTrace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, partialType: PARTIAL_TYPES.REDUCED })
  assert.equal(transaction.sampled, true)
  assert.equal(transaction.priority, 2)
  assert.equal(transaction.partialType, 'reduced')
})

test('AlwaysOnSampler should return null when transaction is not provided', (t) => {
  const { sampler } = t.nr
  assert.doesNotThrow(() => {
    sampler.applySamplingDecision({ transaction: null })
  })
})
