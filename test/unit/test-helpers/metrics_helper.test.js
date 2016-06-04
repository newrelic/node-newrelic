'use strict'

var path   = require('path')
  , chai   = require('chai')
  , assert = require('assert')
  , expect = chai.expect
  , AssertionError = chai.AssertionError

var metricsHelper = require('../../lib/metrics_helper.js')


function MockSegment(name, children) {
  this.name = name
  this.children = []
  if (children) {
    this.children = children
  }
}

describe("assertSegments", function () {
  it('finds missing segment', function() {
    var parent = new MockSegment('a')
    var expected = [
      'b'
    ]

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "a" should have child "b" in position 1')
  })

  it('finds missing segment among many', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b')
    ])
    var expected = [
      'b',
      'c'
    ]

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "a" should have child "c" in position 2')
  })

  it('finds missing segment deep', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b')
    ])
    var expected = [
      'b',
      [
        'c'
      ]
    ]

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" should have child "c" in position 1')
  })

  it('finds extra segment', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b')
    ])
    var expected = []

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "a" expected to have 0 children')
  })

  it('finds extra segment deep', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b', [
        new MockSegment('c'),
        new MockSegment('d')
      ])
    ])
    var expected = [
      'b',
      [
        'c'
      ]
    ]

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" expected to have 1 children')
  })

  it('finds when segment has no children', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b', [
        new MockSegment('c')
      ])
    ])
    var expected = [
      'b'
    ]

    var bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" should not have any children')
  })

  it('ignores excluded segments', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b'),
      new MockSegment('c')
    ])
    var expected = [
      'b',
    ]

    var options = {
      exact: true,
      exclude: [ 'c' ]
    }

    var bound = metricsHelper.assertSegments.bind(null, parent, expected, options)
    expect(bound).to.not.throw()
  })

  it('ignores excluded segments deep', function() {
    var parent = new MockSegment('a', [
      new MockSegment('b', [
        new MockSegment('c'),
        new MockSegment('d', [
          new MockSegment('c')
        ])
      ])
    ])
    var expected = [
      'b',
      [ 'd' ]
    ]

    var options = {
      exact: true,
      exclude: [ 'c' ]
    }

    var bound = metricsHelper.assertSegments.bind(null, parent, expected, options)
    expect(bound).to.not.throw()
  })
})