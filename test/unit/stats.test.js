/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Stats = require('../../lib/stats')

function verifyStats(actualStats, expectedStats) {
  this.equal(actualStats.callCount, expectedStats.callCount)
  this.equal(actualStats.total, expectedStats.totalTime)
  this.equal(actualStats.totalExclusive, expectedStats.totalExclusive)
  this.equal(actualStats.min, expectedStats.min)
  this.equal(actualStats.max, expectedStats.max)
  this.equal(actualStats.sumOfSquares, expectedStats.sumOfSquares)
}

tap.Test.prototype.addAssert('verifyStats', 2, verifyStats)

tap.test('Stats', function (t) {
  t.autoend()

  t.beforeEach(function (t) {
    t.context.statistics = new Stats()
  })

  t.test('should correctly summarize a sample set of statistics', function (t) {
    const { statistics } = t.context
    const expectedStats = {
      callCount: 3,
      totalTime: 0.306,
      totalExclusive: 0.128,
      min: 0.06,
      max: 0.123,
      sumOfSquares: 0.033858
    }

    statistics.recordValueInMillis(60)
    statistics.recordValueInMillis(123, 34)
    statistics.recordValueInMillis(123, 34)

    t.verifyStats(statistics, expectedStats)
    t.end()
  })

  t.test('should correctly summarize another simple set of statistics', function (t) {
    const { statistics } = t.context
    const expectedStats = {
      callCount: 2,
      totalTime: 0.24,
      totalExclusive: 0.0,
      min: 0.12,
      max: 0.12,
      sumOfSquares: 0.0288
    }

    statistics.recordValueInMillis(120, 0)
    statistics.recordValueInMillis(120, 0)

    t.verifyStats(statistics, expectedStats)
    t.end()
  })

  t.test('incrementCallCount', function (t) {
    t.autoend()
    t.test('should increment by 1 by default', function (t) {
      const { statistics } = t.context
      const expectedStats = {
        callCount: 1,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount()
      t.verifyStats(statistics, expectedStats)
      t.end()
    })

    t.test('should increment by the provided value', function (t) {
      const { statistics } = t.context
      const expectedStats = {
        callCount: 23,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount(23)
      t.verifyStats(statistics, expectedStats)
      t.end()
    })

    t.test("shouldn't increment when the provided value is 0", function (t) {
      const { statistics } = t.context
      const expectedStats = {
        callCount: 0,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount(0)
      t.verifyStats(statistics, expectedStats)
      t.end()
    })
  })

  t.test('should correctly merge summaries', function (t) {
    const { statistics } = t.context
    const expectedStats = {
      callCount: 3,
      totalTime: 0.306,
      totalExclusive: 0.128,
      min: 0.06,
      max: 0.123,
      sumOfSquares: 0.033858
    }

    statistics.recordValueInMillis(60)
    statistics.recordValueInMillis(123, 34)
    statistics.recordValueInMillis(123, 34)

    t.verifyStats(statistics, expectedStats)

    const expectedStatsOther = {
      callCount: 2,
      totalTime: 0.246,
      totalExclusive: 0.0,
      min: 0.123,
      max: 0.123,
      sumOfSquares: 0.030258
    }

    const other = new Stats()
    other.recordValueInMillis(123, 0)
    other.recordValueInMillis(123, 0)

    t.verifyStats(other, expectedStatsOther)

    const expectedStatsMerged = {
      callCount: 5,
      totalTime: 0.552,
      totalExclusive: 0.128,
      min: 0.06,
      max: 0.123,
      sumOfSquares: 0.064116
    }

    statistics.merge(other)
    t.verifyStats(statistics, expectedStatsMerged)
    t.end()
  })

  t.test('when handling quantities', { todo: true }, function (t) {
    t.test('should store bytes as bytes, rescaling only at serialization', { todo: true })
    t.test('should store time as nanoseconds, rescaling only at serialization', { todo: true })
  })

  t.test('recordValueInBytes', function (t) {
    t.autoend()
    const MEGABYTE = 1024 ** 2

    t.test('should measure bytes as megabytes', function (t) {
      const { statistics } = t.context
      statistics.recordValueInBytes(MEGABYTE)
      t.equal(statistics.total, 1)
      t.equal(statistics.totalExclusive, 1)
      t.end()
    })

    t.test('should measure exclusive bytes ok', function (t) {
      const { statistics } = t.context
      statistics.recordValueInBytes(MEGABYTE * 2, MEGABYTE)
      t.equal(statistics.total, 2)
      t.equal(statistics.totalExclusive, 1)
      t.end()
    })

    t.test('should optionally not convert bytes to megabytes', function (t) {
      const { statistics } = t.context
      statistics.recordValueInBytes(MEGABYTE * 2, MEGABYTE, true)
      t.equal(statistics.total, MEGABYTE * 2)
      t.equal(statistics.totalExclusive, MEGABYTE)
      t.end()
    })
  })
})
