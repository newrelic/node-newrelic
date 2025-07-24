/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { performance } = require('node:perf_hooks')

const normalizeTimestamp = require('#agentlib/otel/logs/normalize-timestamp.js')

const TS_FIXTURE = 1752577200000 // 2026-07-15T07:00:00.000-04:00

test('normalizes nanoseconds', () => {
  const found = normalizeTimestamp(1.7525772e+18)
  assert.equal(found, TS_FIXTURE)
})

test('normalizes microseconds', () => {
  const found = normalizeTimestamp(1.7525772e+15)
  assert.equal(found, TS_FIXTURE)
})

test('normalizes milliseconds', () => {
  const found = normalizeTimestamp(TS_FIXTURE)
  assert.equal(found, TS_FIXTURE)
})

test('normalizes Date instance', () => {
  const found = normalizeTimestamp(new Date(TS_FIXTURE))
  assert.equal(found, TS_FIXTURE)
})

test('normalizes performance.now', () => {
  const dnow = Date.now()
  const pnow = performance.now()
  const found = normalizeTimestamp(pnow)
  assert.equal(found >= dnow, true)
  assert.equal(isNaN(new Date(found)), false)
})

test('normalizes hrtime', () => {
  const dnow = Date.now()
  const input = process.hrtime()
  const found = normalizeTimestamp(input)
  assert.equal(found >= dnow, true)
  assert.equal(isNaN(new Date(found)), false)
})

test('normalizes junk', () => {
  const dnow = Date.now()
  const input = 'some garbage'
  const found = normalizeTimestamp(input)
  assert.equal(found >= dnow, true)
  assert.equal(isNaN(new Date(found)), false)
})
