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
const AssertionError = chai.AssertionError

const metricsHelper = require('../../lib/metrics_helper.js')

function MockSegment(name, children) {
  this.name = name
  this.children = []
  if (children) {
    this.children = children
  }
}

describe('assertSegments', function () {
  it('finds missing segment', function () {
    const parent = new MockSegment('a')
    const expected = ['b']

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)

    expect(bound).to.throw(AssertionError, 'segment "a" should have child "b" in position 1')
  })

  it('finds missing segment among many', function () {
    const parent = new MockSegment('a', [new MockSegment('b')])
    const expected = ['b', 'c']

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "a" should have child "c" in position 2')
  })

  it('finds missing segment deep', function () {
    const parent = new MockSegment('a', [new MockSegment('b')])
    const expected = ['b', ['c']]

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" should have child "c" in position 1')
  })

  it('finds extra segment', function () {
    const parent = new MockSegment('a', [new MockSegment('b')])
    const expected = []

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "a" expected to have 0 children')
  })

  it('finds extra segment deep', function () {
    const parent = new MockSegment('a', [
      new MockSegment('b', [new MockSegment('c'), new MockSegment('d')])
    ])
    const expected = ['b', ['c']]

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" expected to have 1 children')
  })

  it('finds when segment has no children', function () {
    const parent = new MockSegment('a', [new MockSegment('b', [new MockSegment('c')])])
    const expected = ['b']

    const bound = metricsHelper.assertSegments.bind(null, parent, expected)
    expect(bound).to.throw(AssertionError, 'segment "b" should not have any children')
  })

  it('ignores excluded segments', function () {
    const parent = new MockSegment('a', [new MockSegment('b'), new MockSegment('c')])
    const expected = ['b']

    const options = {
      exact: true,
      exclude: ['c']
    }

    const bound = metricsHelper.assertSegments.bind(null, parent, expected, options)
    expect(bound).to.not.throw()
  })

  it('ignores excluded segments deep', function () {
    const parent = new MockSegment('a', [
      new MockSegment('b', [new MockSegment('c'), new MockSegment('d', [new MockSegment('c')])])
    ])
    const expected = ['b', ['d']]

    const options = {
      exact: true,
      exclude: ['c']
    }

    const bound = metricsHelper.assertSegments.bind(null, parent, expected, options)
    expect(bound).to.not.throw()
  })
})
