/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const {
  isTimeInput,
  isHrTime,
  hrTime,
  toHrTime,
  hrTimeDiff,
  hrTimeToMilliseconds
} = require('#agentlib/otel/utils/time.js')

test('hrTime returns a [seconds, nanoseconds] tuple representing now', () => {
  const before = Date.now()
  const found = hrTime()
  const after = Date.now()

  assert.equal(Array.isArray(found), true)
  assert.equal(found.length, 2)
  assert.equal(typeof found[0], 'number')
  assert.equal(typeof found[1], 'number')
  assert.equal(found[1] >= 0 && found[1] < 1_000_000_000, true)

  const ms = found[0] * 1_000 + found[1] / 1e6
  // `Date.now()` floors to whole milliseconds while `hrTime()` retains
  // sub-millisecond precision, so allow a small tolerance on either bound.
  assert.equal(ms >= before - 1, true)
  assert.equal(ms <= after + 1, true)
})

test('toHrTime returns the current time when given null or undefined', () => {
  const before = Date.now()
  const foundNull = toHrTime(null)
  const foundUndefined = toHrTime(undefined)
  const foundNoArg = toHrTime()
  const after = Date.now()

  for (const found of [foundNull, foundUndefined, foundNoArg]) {
    const ms = found[0] * 1_000 + found[1] / 1e6
    assert.equal(ms >= before - 1, true)
    assert.equal(ms <= after + 1, true)
  }
})

test('toHrTime returns an existing HrTime tuple unchanged', () => {
  const input = [1764938931, 327000000]
  const found = toHrTime(input)
  assert.equal(found, input)
  assert.deepEqual(found, [1764938931, 327000000])
})

test('toHrTime converts a Date instance', () => {
  const date = new Date('2025-12-05T12:48:51.327Z')
  const found = toHrTime(date)
  assert.deepEqual(found, [1764938931, 327000000])
})

test('toHrTime converts epoch milliseconds', () => {
  const found = toHrTime(1764938931327)
  assert.deepEqual(found, [1764938931, 327000000])
})

test('toHrTime handles epoch milliseconds with no fractional remainder', () => {
  const found = toHrTime(1764938931000)
  assert.deepEqual(found, [1764938931, 0])
})

test('hrTimeDiff computes a simple difference with no underflow', () => {
  const start = [100, 200]
  const end = [105, 900]
  const found = hrTimeDiff(start, end)
  assert.deepEqual(found, [5, 700])
})

test('hrTimeDiff borrows a second when nanoseconds underflow', () => {
  const start = [100, 900_000_000]
  const end = [105, 100_000_000]
  const found = hrTimeDiff(start, end)
  assert.deepEqual(found, [4, 200_000_000])
})

test('hrTimeDiff returns zero for identical times', () => {
  const time = [100, 500]
  const found = hrTimeDiff(time, time)
  assert.deepEqual(found, [0, 0])
})

test('hrTimeToMilliseconds converts seconds and nanoseconds to milliseconds', () => {
  assert.equal(hrTimeToMilliseconds([1764938931, 327000000]), 1764938931327)
})

test('hrTimeToMilliseconds handles zero', () => {
  assert.equal(hrTimeToMilliseconds([0, 0]), 0)
})

test('hrTimeToMilliseconds handles fractional millisecond remainders', () => {
  assert.equal(hrTimeToMilliseconds([1, 500000]), 1000.5)
})

test('isHrTime returns true for a valid HrTime tuple', () => {
  assert.equal(isHrTime([1764938931, 327000000]), true)
  assert.equal(isHrTime([0, 0]), true)
})

test('isHrTime returns false for non-array values', () => {
  assert.equal(isHrTime('not an array'), false)
  assert.equal(isHrTime(123), false)
  assert.equal(isHrTime(new Date()), false)
  assert.equal(isHrTime(null), false)
  assert.equal(isHrTime(undefined), false)
  assert.equal(isHrTime({}), false)
})

test('isHrTime returns false for arrays of the wrong length', () => {
  assert.equal(isHrTime([]), false)
  assert.equal(isHrTime([1]), false)
  assert.equal(isHrTime([1, 2, 3]), false)
})

test('isHrTime returns false for arrays with non-number elements', () => {
  assert.equal(isHrTime(['1', 2]), false)
  assert.equal(isHrTime([1, '2']), false)
  assert.equal(isHrTime([null, 2]), false)
  assert.equal(isHrTime([1, undefined]), false)
})

test('isTimeInput returns true for a number', () => {
  assert.equal(isTimeInput(1764938931327), true)
  assert.equal(isTimeInput(0), true)
})

test('isTimeInput returns true for a Date instance', () => {
  assert.equal(isTimeInput(new Date()), true)
})

test('isTimeInput returns true for an HrTime tuple', () => {
  assert.equal(isTimeInput([1764938931, 327000000]), true)
})

test('isTimeInput returns false for a plain attributes object', () => {
  assert.equal(isTimeInput({ key: 'value' }), false)
})

test('isTimeInput returns false for a string', () => {
  assert.equal(isTimeInput('not a time'), false)
})

test('isTimeInput returns false for null and undefined', () => {
  assert.equal(isTimeInput(null), false)
  assert.equal(isTimeInput(undefined), false)
})
