/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const generateRecorder = require('../../../lib/metrics/recorders/http_external')
const Transaction = require('../../../lib/transaction')

function recordExternal(segment, scope, transaction) {
  return generateRecorder('test.example.com', 'http')(segment, scope, transaction)
}

function makeSegment(options) {
  const segment = options.transaction.trace.add('placeholder')
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
  recordExternal(segment, options.transaction.name, options.transaction)
}

test('recordExternal', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    const trans = new Transaction(agent)
    trans.type = Transaction.TYPES.BG
    ctx.nr.agent = agent
    ctx.nr.trans = trans
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test("when scoped is undefined it shouldn't crash on recording", function (t) {
    const { trans } = t.nr
    const segment = makeSegment({
      transaction: trans,
      duration: 0,
      exclusive: 0
    })
    assert.doesNotThrow(function () {
      recordExternal(segment, undefined, trans)
    })
  })

  await t.test('when scoped is undefined it should record no scoped metrics', function (t) {
    const { trans } = t.nr
    const segment = makeSegment({
      transaction: trans,
      duration: 0,
      exclusive: 0
    })
    recordExternal(segment, undefined, trans)

    const result = [
      [{ name: 'External/test.example.com/http' }, [1, 0, 0, 0, 0, 0]],
      [{ name: 'External/allOther' }, [1, 0, 0, 0, 0, 0]],
      [{ name: 'External/test.example.com/all' }, [1, 0, 0, 0, 0, 0]],
      [{ name: 'External/all' }, [1, 0, 0, 0, 0, 0]]
    ]

    assert.equal(JSON.stringify(trans.metrics), JSON.stringify(result))
  })

  await t.test('with scope should record scoped metrics', function (t) {
    const { trans } = t.nr
    trans.type = Transaction.TYPES.WEB
    record({
      transaction: trans,
      url: '/test',
      code: 200,
      apdexT: 10,
      duration: 30,
      exclusive: 2
    })

    const result = [
      [{ name: 'External/test.example.com/http' }, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
      [{ name: 'External/allWeb' }, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
      [{ name: 'External/test.example.com/all' }, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
      [{ name: 'External/all' }, [1, 0.03, 0.002, 0.03, 0.03, 0.0009]],
      [
        { name: 'External/test.example.com/http', scope: 'WebTransaction/NormalizedUri/*' },
        [1, 0.03, 0.002, 0.03, 0.03, 0.0009]
      ]
    ]

    assert.equal(JSON.stringify(trans.metrics), JSON.stringify(result))
  })

  await t.test('should report exclusive time correctly', function (t) {
    const { trans } = t.nr
    const root = trans.trace.root
    const parent = trans.trace.add('/parent', recordExternal)
    const child1 = trans.trace.add('/child1', generateRecorder('api.twitter.com', 'https'), parent)
    const child2 = trans.trace.add(
      '/child2',
      generateRecorder('oauth.facebook.com', 'http'),
      parent
    )

    root.setDurationInMillis(32, 0)
    parent.setDurationInMillis(32, 0)
    child1.setDurationInMillis(15, 10)
    child2.setDurationInMillis(2, 1)

    const result = [
      [{ name: 'External/test.example.com/http' }, [1, 0.032, 0.015, 0.032, 0.032, 0.001024]],
      [{ name: 'External/allOther' }, [3, 0.049, 0.032, 0.002, 0.032, 0.001253]],
      [{ name: 'External/test.example.com/all' }, [1, 0.032, 0.015, 0.032, 0.032, 0.001024]],
      [{ name: 'External/all' }, [3, 0.049, 0.032, 0.002, 0.032, 0.001253]],
      [{ name: 'External/api.twitter.com/https' }, [1, 0.015, 0.015, 0.015, 0.015, 0.000225]],
      [{ name: 'External/api.twitter.com/all' }, [1, 0.015, 0.015, 0.015, 0.015, 0.000225]],
      [{ name: 'External/oauth.facebook.com/http' }, [1, 0.002, 0.002, 0.002, 0.002, 0.000004]],
      [{ name: 'External/oauth.facebook.com/all' }, [1, 0.002, 0.002, 0.002, 0.002, 0.000004]]
    ]

    trans.end()
    assert.equal(JSON.stringify(trans.metrics), JSON.stringify(result))
  })
})
