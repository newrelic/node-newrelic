/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper.js')
const Transaction = require('../../../lib/transaction')
const NAMES = require('../../../lib/metrics/names.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('Transaction could contain appropriate intrinsic attributes', (t) => {
  const { agent } = t.nr
  const duration = 0.02
  const totalTime = 0.03
  const txName = 'WebTransaction/Custom/unitTestTx'
  const start = Date.now()
  const tx = getMockTransaction({ agent, start, duration, totalTime, txName })
  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)

  assert.deepStrictEqual(Object.keys(attrs).sort(), [
    'duration',
    'error',
    'guid',
    'name',
    'priority',
    'sampled',
    'timestamp',
    'totalTime',
    'traceId',
    'type',
    'webDuration'
  ])

  assert.equal(attrs.duration, duration)
  assert.equal(attrs.webDuration, duration)
  assert.equal(attrs.totalTime, totalTime)

  assert.equal(attrs.timestamp, start)
  assert.equal(attrs.name, txName)
  assert.equal(attrs.type, 'Transaction')
  assert.equal(attrs.error, false)
})

test('includes queueDuration', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  tx.measure(NAMES.QUEUETIME, null, 100)

  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  assert.equal(attrs.queueDuration, 0.1)
})

test('includes externalDuration', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  tx.measure(NAMES.EXTERNAL.ALL, null, 100)

  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  assert.equal(attrs.externalDuration, 0.1)
})

test('includes databaseDuration', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  tx.measure(NAMES.DB.ALL, null, 100)

  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  assert.equal(attrs.databaseDuration, 0.1)
})

test('includes externalCallCount', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  tx.measure(NAMES.EXTERNAL.ALL, null, 100)
  tx.measure(NAMES.EXTERNAL.ALL, null, 100)

  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  assert.equal(attrs.externalCallCount, 2)
})

test('includes databaseCallCount', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  tx.measure(NAMES.DB.ALL, null, 100)
  tx.measure(NAMES.DB.ALL, null, 100)

  const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  assert.equal(attrs.databaseCallCount, 2)
})

test('should call transaction.hasErrors() for error attribute', (t) => {
  const { agent } = t.nr
  const tx = new Transaction(agent)
  let mock = null
  let attrs = null

  mock = sinon.mock(tx)
  mock.expects('hasErrors').returns(true)
  attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  mock.verify()
  mock.restore()
  assert.equal(attrs.error, true)

  mock = sinon.mock(tx)
  mock.expects('hasErrors').returns(false)
  attrs = agent._addIntrinsicAttrsFromTransaction(tx)
  mock.verify()
  mock.restore()
  assert.equal(attrs.error, false)
})

function getMockTransaction({ agent, start, duration, totalTime, txName }) {
  const transaction = new Transaction(agent)

  transaction.name = txName
  transaction.id = '9323dc260548ed0e'
  transaction.type = 'web'

  const durationInMilliseconds = duration * 1000
  const totalTimeInMilliseconds = totalTime * 1000

  transaction.timer.start = start

  transaction.timer.getDurationInMillis = function stubDurationInMillis() {
    return durationInMilliseconds
  }

  transaction.trace.getTotalTimeDurationInMillis = function stubTotalTimeInMillis() {
    return totalTimeInMilliseconds
  }

  return transaction
}
