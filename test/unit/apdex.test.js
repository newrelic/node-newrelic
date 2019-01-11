'use strict'

const chai = require('chai')
const expect = chai.expect
const ApdexStats = require('../../lib/stats/apdex')


describe("ApdexStats", function() {
  var statistics

  beforeEach(function() {
    statistics = new ApdexStats(0.3)
  })

  it("should throw when created with no tolerating value", function() {
    /* eslint-disable no-unused-vars */
    let apdex = null
    /* eslint-enable no-unused-vars */

    expect(function() { apdex = new ApdexStats() })
      .throws('Apdex summary must be created with apdexT')
  })

  it("should export apdexT in the 4th field of the timeslice", function() {
    expect(statistics.toJSON()[3]).equal(0.3)
  })

  it("should export apdexT in the 5th field (why?) of the timeslice", function() {
    expect(statistics.toJSON()[4]).equal(0.3)
  })

  it("should correctly summarize a sample set of statistics", function() {
    statistics.recordValueInMillis(1251)
    statistics.recordValueInMillis(250)
    statistics.recordValueInMillis(487)

    const expectedStats = {satisfying: 1, tolerating: 1, frustrating: 1}

    verifyApdexStats(statistics, expectedStats)
  })

  it("should correctly summarize another simple set of statistics", function() {
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)
    statistics.recordValueInMillis(120)

    const expectedStats = {satisfying: 4, tolerating: 0, frustrating: 0}

    verifyApdexStats(statistics, expectedStats)
  })

  it("should correctly merge summaries", function() {
    statistics.recordValueInMillis(1251)
    statistics.recordValueInMillis(250)
    statistics.recordValueInMillis(487)

    const expectedStats = {satisfying: 1, tolerating: 1, frustrating: 1}
    verifyApdexStats(statistics, expectedStats)

    var other = new ApdexStats(0.3)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)
    other.recordValueInMillis(120)

    const expectedOtherStats = {satisfying: 4, tolerating: 0, frustrating: 0}
    verifyApdexStats(other, expectedOtherStats)

    statistics.merge(other)

    const expectedMergedStats = {satisfying: 5, tolerating: 1, frustrating: 1}
    verifyApdexStats(statistics, expectedMergedStats)
  })

  function verifyApdexStats(actualStats, expectedStats) {
    expect(actualStats.satisfying).equal(expectedStats.satisfying)
    expect(actualStats.tolerating).equal(expectedStats.tolerating)
    expect(actualStats.frustrating).equal(expectedStats.frustrating)
  }
})
