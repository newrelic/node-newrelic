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
const helper = require('../../lib/agent_helper')
const recordGeneric = require('../../../lib/metrics/recorders/generic')
const Transaction = require('../../../lib/transaction')

function makeSegment(options) {
  const segment = options.transaction.trace.root.add('placeholder')
  segment.setDurationInMillis(options.duration)
  segment._setExclusiveDurationInMillis(options.exclusive)

  return segment
}

function record(options) {
  if (options.apdexT) {
    options.transaction.metrics.apdexT = options.apdexT
  }

  const segment = makeSegment(options)
  const transaction = options.transaction

  transaction.finalizeNameFromUri(options.url, options.code)
  recordGeneric(segment, options.transaction.name)
}

describe('recordGeneric', function () {
  let agent
  let trans

  beforeEach(function () {
    agent = helper.loadMockedAgent()
    trans = new Transaction(agent)
  })

  afterEach(function () {
    helper.unloadAgent(agent)
  })

  describe('when scope is undefined', function () {
    it("shouldn't crash on recording", function () {
      const segment = makeSegment({
        transaction: trans,
        duration: 0,
        exclusive: 0
      })
      expect(function () {
        recordGeneric(segment, undefined)
      }).not.throws()
    })

    it('should record no scoped metrics', function () {
      const segment = makeSegment({
        transaction: trans,
        duration: 5,
        exclusive: 5
      })
      recordGeneric(segment, undefined)

      const result = [[{ name: 'placeholder' }, [1, 0.005, 0.005, 0.005, 0.005, 0.000025]]]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  describe('with scope', function () {
    it('should record scoped metrics', function () {
      record({
        transaction: trans,
        url: '/test',
        code: 200,
        apdexT: 10,
        duration: 30,
        exclusive: 2
      })

      const result = [
        [{ name: 'placeholder' }, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
        [
          { name: 'placeholder', scope: 'WebTransaction/NormalizedUri/*' },
          [1, 0.03, 0.002, 0.03, 0.03, 0.0009]
        ]
      ]

      expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
    })
  })

  it('should report exclusive time correctly', function () {
    const root = trans.trace.root
    const parent = root.add('Test/Parent', recordGeneric)
    const child1 = parent.add('Test/Child/1', recordGeneric)
    const child2 = parent.add('Test/Child/2', recordGeneric)

    root.setDurationInMillis(30, 0)
    parent.setDurationInMillis(30, 0)
    child1.setDurationInMillis(12, 3)
    child2.setDurationInMillis(8, 17)

    const result = [
      [{ name: 'Test/Parent' }, [1, 0.03, 0.01, 0.03, 0.03, 0.0009]],
      [{ name: 'Test/Child/1' }, [1, 0.012, 0.012, 0.012, 0.012, 0.000144]],
      [{ name: 'Test/Child/2' }, [1, 0.008, 0.008, 0.008, 0.008, 0.000064]]
    ]

    trans.end()
    expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result))
  })
})
