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
const crossAgentTests = require('../../lib/cross_agent_tests/cat/cat_map.json')
const CAT = require('../../../lib/util/cat.js')
const NAMES = require('../../../lib/metrics/names.js')

test('when CAT is disabled (default agent settings)', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for await (const cat of crossAgentTests) {
    await t.test(cat.name + ' tx event should only contain non-CAT intrinsic attrs', (t) => {
      const { agent } = t.nr
      const expectedDuration = 0.02
      const expectedTotalTime = 0.03
      const start = Date.now()
      const tx = getMockTransaction(agent, cat, start, expectedDuration, expectedTotalTime)
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

      assert.equal(attrs.duration, expectedDuration)
      assert.equal(attrs.webDuration, expectedDuration)
      assert.equal(attrs.totalTime, expectedTotalTime)

      assert.equal(attrs.timestamp, start)
      assert.equal(attrs.name, cat.transactionName)
      assert.equal(attrs.type, 'Transaction')
      assert.equal(attrs.error, false)
    })
  }

  await t.test('includes queueDuration', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.measure(NAMES.QUEUETIME, null, 100)

    const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
    assert.equal(attrs.queueDuration, 0.1)
  })

  await t.test('includes externalDuration', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.measure(NAMES.EXTERNAL.ALL, null, 100)

    const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
    assert.equal(attrs.externalDuration, 0.1)
  })

  await t.test('includes databaseDuration', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.measure(NAMES.DB.ALL, null, 100)

    const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
    assert.equal(attrs.databaseDuration, 0.1)
  })

  await t.test('includes externalCallCount', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.measure(NAMES.EXTERNAL.ALL, null, 100)
    tx.measure(NAMES.EXTERNAL.ALL, null, 100)

    const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
    assert.equal(attrs.externalCallCount, 2)
  })

  await t.test('includes databaseCallCount', (t) => {
    const { agent } = t.nr
    const tx = new Transaction(agent)
    tx.measure(NAMES.DB.ALL, null, 100)
    tx.measure(NAMES.DB.ALL, null, 100)

    const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
    assert.equal(attrs.databaseCallCount, 2)
  })

  await t.test('should call transaction.hasErrors() for error attribute', (t) => {
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
})

test('when CAT is enabled', async (t) => {
  const expectedDurationsInSeconds = [0.03, 0.15, 0.5]

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      apdex_t: 0.05,
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false }
    })
    ctx.nr.agent.config.applications = function newFake() {
      return ['testAppName']
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for (let i = 0; i < crossAgentTests.length; i += 1) {
    const cat = crossAgentTests[i]
    await t.test(cat.name + ' tx event should contain all intrinsic attrs', (t) => {
      const { agent } = t.nr
      const idx = i % expectedDurationsInSeconds.length
      const expectedDuration = expectedDurationsInSeconds[idx]
      const expectedTotalTime = 0.03
      const start = Date.now()
      const tx = getMockTransaction(agent, cat, start, expectedDuration, expectedTotalTime)
      const attrs = agent._addIntrinsicAttrsFromTransaction(tx)
      const keys = [
        'webDuration',
        'timestamp',
        'name',
        'duration',
        'totalTime',
        'type',
        'error',
        'nr.guid',
        'nr.tripId',
        'nr.pathHash',
        'nr.referringPathHash',
        'nr.referringTransactionGuid',
        'nr.alternatePathHashes',
        'nr.apdexPerfZone'
      ]

      for (let j = 0; j < cat.nonExpectedIntrinsicFields.length; ++j) {
        keys.splice(keys.indexOf(cat.nonExpectedIntrinsicFields[j]), 1)
      }

      if (Object.hasOwn(cat.expectedIntrinsicFields, 'nr.pathHash') === false) {
        keys.splice(keys.indexOf('nr.apdexPerfZone'), 1)
      }

      assert.deepStrictEqual(Object.keys(attrs), keys)

      assert.equal(attrs.duration, expectedDuration)
      assert.equal(attrs.webDuration, expectedDuration)
      assert.equal(attrs.totalTime, expectedTotalTime)
      assert.equal(attrs.duration, expectedDuration)
      assert.equal(attrs.timestamp, start)
      assert.equal(attrs.name, cat.transactionName)
      assert.equal(attrs.type, 'Transaction')
      assert.equal(attrs.error, false)
      assert.equal(attrs['nr.guid'], cat.expectedIntrinsicFields['nr.guid'])
      assert.equal(attrs['nr.pathHash'], cat.expectedIntrinsicFields['nr.pathHash'])
      assert.equal(
        attrs['nr.referringPathHash'],
        cat.expectedIntrinsicFields['nr.referringPathHash']
      )
      assert.equal(attrs['nr.tripId'], cat.expectedIntrinsicFields['nr.tripId'])

      assert.equal(
        cat.expectedIntrinsicFields['nr.referringTransactionGuid'],
        attrs['nr.referringTransactionGuid']
      )

      assert.equal(
        cat.expectedIntrinsicFields['nr.alternatePathHashes'],
        attrs['nr.alternatePathHashes']
      )

      if (Object.hasOwn(cat.expectedIntrinsicFields, 'nr.pathHash') === true) {
        // nr.apdexPerfZone not specified in the test, this is used to exercise it.
        const attr = attrs['nr.apdexPerfZone']
        switch (idx) {
          case 0: {
            assert.equal(attr, 'S')
            break
          }
          case 1: {
            assert.equal(attr, 'T')
            break
          }
          case 2: {
            assert.equal(attr, 'F')
            break
          }
        }
      }
    })
  }
})

function getMockTransaction(agent, test, start, durationInSeconds, totalTimeInSeconds) {
  const transaction = new Transaction(agent)

  // non-CAT data
  transaction.name = test.transactionName
  transaction.id = test.transactionGuid
  transaction.type = 'web'

  const durationInMilliseconds = durationInSeconds * 1000
  const totalTimeInMilliseconds = totalTimeInSeconds * 1000

  transaction.timer.start = start

  transaction.timer.getDurationInMillis = function stubDurationInMillis() {
    return durationInMilliseconds
  }

  transaction.trace.getTotalTimeDurationInMillis = function stubTotalTimeInMillis() {
    return totalTimeInMilliseconds
  }

  // CAT data
  if (test.inboundPayload) {
    CAT.assignCatToTransaction(test.inboundPayload[0], test.inboundPayload, transaction)
  } else {
    // Simulate the headers being unparsable or not existing
    CAT.assignCatToTransaction(null, null, transaction)
  }

  if (test.outboundRequests) {
    test.outboundRequests.forEach(function (req) {
      transaction.pushPathHash(req.expectedOutboundPayload[3])
    })
  }

  transaction.baseSegment = {
    // used by nr.apdexPerfZone
    getDurationInMillis: function () {
      return durationInMilliseconds
    }
  }

  return transaction
}
