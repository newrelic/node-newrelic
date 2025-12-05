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

test('should set toString and Object.prototype.toString correctly', (t) => {
  const { sampler } = t.nr
  assert.equal(sampler.toString(), 'AlwaysOffSampler')
  assert.equal(Object.prototype.toString.call(sampler), '[object AlwaysOffSampler]')
})

test('AlwaysOffSampler should always sample', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction })
  assert.equal(transaction.sampled, false)
  assert.equal(transaction.priority, 0)
  assert.equal(transaction.partialType, undefined)
})

test('AlwaysOffSampler should assign partialType to true when not a fullTrace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, partialType: 'reduced' })
  assert.equal(transaction.sampled, false)
  assert.equal(transaction.priority, 0)
  assert.equal(transaction.partialType, 'reduced')
})

test('AlwaysOffSampler should return null when transaction is not provided', (t) => {
  const { sampler } = t.nr
  assert.doesNotThrow(() => {
    sampler.applySamplingDecision({ transaction: null })
  })
})
