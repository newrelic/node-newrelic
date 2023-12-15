/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const ApdexStats = require('../../lib/stats/apdex')
tap.Test.prototype.addAssert(
  'verifyApdexStats',
  2,
  function verifyApdexStats(actualStats, expectedStats) {
    this.equal(actualStats.satisfying, expectedStats.satisfying)
    this.equal(actualStats.tolerating, expectedStats.tolerating)
    this.equal(actualStats.frustrating, expectedStats.frustrating)
  }
)

tap.test('ApdexStats', function (t) {
  t.autoend()
  t.beforeEach(function (t) {
    t.context.statistics = new ApdexStats(0.3)
  })

  t.test('should throw when created with no tolerating value', function (t) {
    t.throws(function () {
      // eslint-disable-next-line no-new
      new ApdexStats()
    }, 'Apdex summary must be created with apdexT')
    t.end()
  })

  t.test('should export apdexT in the 4th field of the timeslice', function (t) {
    const { statistics } = t.context
    t.equal(statistics.toJSON()[3], 0.3)
    t.end()
  })

  t.test('should export apdexT in the 5th field (why?) of the timeslice', function (t) {
    const { statistics } = t.context
    t.equal(statistics.toJSON()[4], 0.3)
    t.end()
  })

  t.test('should correctly summarize a sample set of statistics', function (t) {
    const { statistics } = t.context
    statistics.recordValueInMillis(1251)
    statistics.recordValueInMillis(250)
    statistics.recordValueInMillis(487)

    const expectedStats = { satisfying: 1, tolerating: 1, frustrating: 1 }

    t.verifyApdexStats(statistics, expectedStats)
    t.end()
  })

  t.test('should correctly summarize another simple set of statistics', function (t) {
    const { statistics } = t.context
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)

    const expectedStats = { satisfying: 4, tolerating: 0, frustrating: 0 }

    t.verifyApdexStats(statistics, expectedStats)
    t.end()
  })

  t.test('should correctly merge summaries', function (t) {
    const { statistics } = t.context
    statistics.recordValueInMillis(1251)
    statistics.recordValueInMillis(250)
    statistics.recordValueInMillis(487)

    const expectedStats = { satisfying: 1, tolerating: 1, frustrating: 1 }
    t.verifyApdexStats(statistics, expectedStats)

    const other = new ApdexStats(0.3)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)

    const expectedOtherStats = { satisfying: 4, tolerating: 0, frustrating: 0 }
    t.verifyApdexStats(other, expectedOtherStats)

    statistics.merge(other)

    const expectedMergedStats = { satisfying: 5, tolerating: 1, frustrating: 1 }
    t.verifyApdexStats(statistics, expectedMergedStats)
    t.end()
  })
})
