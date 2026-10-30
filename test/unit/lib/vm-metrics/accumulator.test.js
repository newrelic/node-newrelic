/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')

const Accumulator = require('#agentlib/vm-metrics/accumulator.js')

test('matches the native metric field shape', () => {
  const accumulator = new Accumulator()
  assert.deepEqual(
    {
      total: accumulator.total,
      min: accumulator.min,
      max: accumulator.max,
      sumOfSquares: accumulator.sumOfSquares,
      count: accumulator.count
    },
    { total: 0, min: 0, max: 0, sumOfSquares: 0, count: 0 }
  )

  accumulator.add(2)
  accumulator.add(4)
  assert.equal(accumulator.count, 2)
  assert.equal(accumulator.total, 6)
  assert.equal(accumulator.min, 2)
  assert.equal(accumulator.max, 4)
  assert.equal(accumulator.sumOfSquares, 20) // 2^2 + 4^2

  accumulator.reset()
  assert.equal(accumulator.count, 0)
  assert.equal(accumulator.total, 0)
})
