'use strict'

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , sumChildren = require('../../lib/util/sum-children')
  

describe("simplifying timings lists", function () {
  it("should correctly reduce a simple list", function () {
    expect(sumChildren([[22, 42]])).equal(20)
  })

  it("should accurately sum overlapping child traces", function () {
    var intervals = []
    // start with a simple interval
    intervals.push([ 0, 22])
    // add another interval completely encompassed by the first
    intervals.push([ 5, 10])
    // add another that starts within the first range but extends beyond
    intervals.push([11, 33])
    // add a final interval that's entirely disjoint
    intervals.push([35, 39])

    expect(sumChildren(intervals)).equal(37)
  })

  it("should accurately sum partially overlapping child traces", function () {
    var intervals = []
    // start with a simple interval
    intervals.push([ 0, 22])
    // add another interval completely encompassed by the first
    intervals.push([ 5, 10])
    // add another that starts simultaneously with the first range but that extends beyond
    intervals.push([ 0, 33])

    expect(sumChildren(intervals)).equal(33)
  })

  it("should accurately sum partially overlapping, open-ranged child traces", function () {
    var intervals = []
    // start with a simple interval
    intervals.push([ 0, 22])
    // add a range that starts at the exact end of the first
    intervals.push([22, 33])

    expect(sumChildren(intervals)).equal(33)
  })
})
