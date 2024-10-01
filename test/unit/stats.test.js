/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const Stats = require('../../lib/stats')

function verifyStats(actualStats, expectedStats) {
  assert.equal(actualStats.callCount, expectedStats.callCount)
  assert.equal(actualStats.total, expectedStats.totalTime)
  assert.equal(actualStats.totalExclusive, expectedStats.totalExclusive)
  assert.equal(actualStats.min, expectedStats.min)
  assert.equal(actualStats.max, expectedStats.max)
  assert.equal(actualStats.sumOfSquares, expectedStats.sumOfSquares)
}

test('Stats', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.statistics = new Stats()
  })

  await t.test('should correctly summarize a sample set of statistics', function (t) {
    const { statistics } = t.nr
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

    verifyStats(statistics, expectedStats)
  })

  await t.test('should correctly summarize another simple set of statistics', function (t) {
    const { statistics } = t.nr
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

    verifyStats(statistics, expectedStats)
  })

  await t.test('incrementCallCount', async function (t) {
    await t.test('should increment by 1 by default', function (t) {
      const { statistics } = t.nr
      const expectedStats = {
        callCount: 1,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount()
      verifyStats(statistics, expectedStats)
    })

    await t.test('should increment by the provided value', function (t) {
      const { statistics } = t.nr
      const expectedStats = {
        callCount: 23,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount(23)
      verifyStats(statistics, expectedStats)
    })

    await t.test("shouldn't increment when the provided value is 0", function (t) {
      const { statistics } = t.nr
      const expectedStats = {
        callCount: 0,
        totalTime: 0,
        totalExclusive: 0,
        min: 0,
        max: 0,
        sumOfSquares: 0
      }

      statistics.incrementCallCount(0)
      verifyStats(statistics, expectedStats)
    })
  })

  await t.test('should correctly merge summaries', function (t) {
    const { statistics } = t.nr
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

    verifyStats(statistics, expectedStats)

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

    verifyStats(other, expectedStatsOther)

    const expectedStatsMerged = {
      callCount: 5,
      totalTime: 0.552,
      totalExclusive: 0.128,
      min: 0.06,
      max: 0.123,
      sumOfSquares: 0.064116
    }

    statistics.merge(other)
    verifyStats(statistics, expectedStatsMerged)
  })

  await t.test('when handling quantities', { todo: true }, async function (t) {
    await t.test('should store bytes as bytes, rescaling only at serialization', { todo: true })
    await t.test('should store time as nanoseconds, rescaling only at serialization', {
      todo: true
    })
  })

  await t.test('recordValueInBytes', async function (t) {
    const MEGABYTE = 1024 ** 2

    await t.test('should measure bytes as megabytes', function (t) {
      const { statistics } = t.nr
      statistics.recordValueInBytes(MEGABYTE)
      assert.equal(statistics.total, 1)
      assert.equal(statistics.totalExclusive, 1)
    })

    await t.test('should measure exclusive bytes ok', function (t) {
      const { statistics } = t.nr
      statistics.recordValueInBytes(MEGABYTE * 2, MEGABYTE)
      assert.equal(statistics.total, 2)
      assert.equal(statistics.totalExclusive, 1)
    })

    await t.test('should optionally not convert bytes to megabytes', function (t) {
      const { statistics } = t.nr
      statistics.recordValueInBytes(MEGABYTE * 2, MEGABYTE, true)
      assert.equal(statistics.total, MEGABYTE * 2)
      assert.equal(statistics.totalExclusive, MEGABYTE)
    })
  })
})
