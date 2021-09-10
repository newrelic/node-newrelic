/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const chai = require('chai')
const expect = chai.expect
const Stats = require('../../lib/stats')

describe('Stats', function () {
  let statistics

  function verifyStats(actualStats, expectedStats) {
    expect(actualStats.callCount).equal(expectedStats.callCount)
    expect(actualStats.total).equal(expectedStats.totalTime)
    expect(actualStats.totalExclusive).equal(expectedStats.totalExclusive)
    expect(actualStats.min).equal(expectedStats.min)
    expect(actualStats.max).equal(expectedStats.max)
    expect(actualStats.sumOfSquares).equal(expectedStats.sumOfSquares)
  }

  beforeEach(function () {
    statistics = new Stats()
  })

  it('should correctly summarize a sample set of statistics', function () {
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

  it('should correctly summarize another simple set of statistics', function () {
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

  describe('when incrementing the call count', function () {
    it('should increment by 1 by default', function () {
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

    it('should increment by the provided value', function () {
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

    it("shouldn't increment when the provided value is 0", function () {
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

  it('should correctly merge summaries', function () {
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

  describe('when handling quantities', function () {
    it('should store bytes as bytes, rescaling only at serialization')
    it('should store time as nanoseconds, rescaling only at serialization')
  })
})
