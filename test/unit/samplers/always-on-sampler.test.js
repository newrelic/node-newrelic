/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const AlwaysOnSampler = require('#agentlib/samplers/always-on-sampler.js')

test.beforeEach((ctx) => {
  const sampler = new AlwaysOnSampler()
  ctx.nr = { sampler }
})

test('should set toString and Object.prototype.toString correctly', (t) => {
  const { sampler } = t.nr
  assert.equal(sampler.toString(), 'AlwaysOnSampler')
  assert.equal(Object.prototype.toString.call(sampler), '[object AlwaysOnSampler]')
})

test('AlwaysOnSampler should always sample', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, isFullTrace: true })
  assert.equal(transaction.sampled, true)
  assert.equal(transaction.priority, 2)
  assert.equal(transaction.isPartialTrace, false)
})

test('AlwaysOnSampler should assign isPartialTrace to true when not a fullTrace', (t) => {
  const { sampler } = t.nr
  const transaction = {}
  sampler.applySamplingDecision({ transaction, isFullTrace: false })
  assert.equal(transaction.sampled, true)
  assert.equal(transaction.priority, 2)
  assert.equal(transaction.isPartialTrace, true)
})

test('AlwaysOnSampler should return null when transaction is not provided', (t) => {
  const { sampler } = t.nr
  assert.doesNotThrow(() => {
    sampler.applySamplingDecision({ transaction: null, isFullTrace: true })
  })
})
