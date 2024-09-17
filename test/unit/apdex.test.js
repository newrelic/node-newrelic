/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const ApdexStats = require('../../lib/stats/apdex')

function verifyApdexStats(actualStats, expectedStats) {
  assert.equal(actualStats.satisfying, expectedStats.satisfying)
  assert.equal(actualStats.tolerating, expectedStats.tolerating)
  assert.equal(actualStats.frustrating, expectedStats.frustrating)
}

test.beforeEach((ctx) => {
  ctx.nr = {
    statistics: new ApdexStats(0.3)
  }
})

test('should throw when created with no tolerating value', () => {
  assert.throws(function () {
    // eslint-disable-next-line no-new
    new ApdexStats()
  }, 'Apdex summary must be created with apdexT')
})

test('should export apdexT in the 4th field of the timeslice', (t) => {
  const { statistics } = t.nr
  assert.equal(statistics.toJSON()[3], 0.3)
})

test('should export apdexT in the 5th field (why?) of the timeslice', (t) => {
  const { statistics } = t.nr
  assert.equal(statistics.toJSON()[4], 0.3)
})

test('should correctly summarize a sample set of statistics', (t) => {
  const { statistics } = t.nr
  statistics.recordValueInMillis(1251)
  statistics.recordValueInMillis(250)
  statistics.recordValueInMillis(487)

  const expectedStats = { satisfying: 1, tolerating: 1, frustrating: 1 }

  verifyApdexStats(statistics, expectedStats)
})

test('should correctly summarize another simple set of statistics', (t) => {
  const { statistics } = t.nr
  statistics.recordValueInMillis(120)
  statistics.recordValueInMillis(120)
  statistics.recordValueInMillis(120)
  statistics.recordValueInMillis(120)

  const expectedStats = { satisfying: 4, tolerating: 0, frustrating: 0 }

  verifyApdexStats(statistics, expectedStats)
})

test('should correctly merge summaries', (t) => {
  const { statistics } = t.nr
  statistics.recordValueInMillis(1251)
  statistics.recordValueInMillis(250)
  statistics.recordValueInMillis(487)

  const expectedStats = { satisfying: 1, tolerating: 1, frustrating: 1 }
  verifyApdexStats(statistics, expectedStats)

  const other = new ApdexStats(0.3)
  other.recordValueInMillis(120)
  other.recordValueInMillis(120)
  other.recordValueInMillis(120)
  other.recordValueInMillis(120)

  const expectedOtherStats = { satisfying: 4, tolerating: 0, frustrating: 0 }
  verifyApdexStats(other, expectedOtherStats)

  statistics.merge(other)

  const expectedMergedStats = { satisfying: 5, tolerating: 1, frustrating: 1 }
  verifyApdexStats(statistics, expectedMergedStats)
})
