/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper.js')
const chai = require('chai')
const assert = chai.assert
const sinon = require('sinon')
const Transaction = require('../../../lib/transaction')
const crossAgentTests = require('../../lib/cross_agent_tests/cat/cat_map.json')
const cat = require('../../../lib/util/cat.js')
const NAMES = require('../../../lib/metrics/names.js')

tap.test('when CAT is disabled (default agent settings)', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  crossAgentTests.forEach(function (test) {
    t.test(test.name + ' tx event should only contain non-CAT intrinsic attrs', (t) => {
      const expectedDuration = 0.02
      const expectedTotalTime = 0.03

      const start = Date.now()

      const trans = getMockTransaction(agent, test, start, expectedDuration, expectedTotalTime)

      const attrs = agent._addIntrinsicAttrsFromTransaction(trans)

      chai
        .expect(Object.keys(attrs))
        .to.have.members([
          'duration',
          'name',
          'timestamp',
          'totalTime',
          'type',
          'webDuration',
          'error',
          'traceId',
          'guid',
          'priority',
          'sampled'
        ])

      chai.expect(attrs.duration).to.be.closeTo(expectedDuration, 0.001)
      chai.expect(attrs.webDuration).to.be.closeTo(expectedDuration, 0.001)
      chai.expect(attrs.totalTime).to.be.closeTo(expectedTotalTime, 0.001)

      t.equal(attrs.timestamp, start)
      t.equal(attrs.name, test.transactionName)
      t.equal(attrs.type, 'Transaction')
      t.equal(attrs.error, false)

      t.end()
    })
  })

  t.test('includes queueDuration', (t) => {
    const transaction = new Transaction(agent)
    transaction.measure(NAMES.QUEUETIME, null, 100)
    const attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    t.equal(attrs.queueDuration, 0.1)

    t.end()
  })

  t.test('includes externalDuration', (t) => {
    const transaction = new Transaction(agent)
    transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
    const attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    t.equal(attrs.externalDuration, 0.1)

    t.end()
  })

  t.test('includes databaseDuration', (t) => {
    const transaction = new Transaction(agent)
    transaction.measure(NAMES.DB.ALL, null, 100)
    const attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    assert.equal(attrs.databaseDuration, 0.1)

    t.end()
  })

  t.test('includes externalCallCount', (t) => {
    const transaction = new Transaction(agent)
    transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
    transaction.measure(NAMES.EXTERNAL.ALL, null, 100)
    const attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    t.equal(attrs.externalCallCount, 2)

    t.end()
  })

  t.test('includes databaseDuration', (t) => {
    const transaction = new Transaction(agent)
    transaction.measure(NAMES.DB.ALL, null, 100)
    transaction.measure(NAMES.DB.ALL, null, 100)
    const attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    t.equal(attrs.databaseCallCount, 2)

    t.end()
  })

  t.test('should call transaction.hasErrors() for error attribute', (t) => {
    const transaction = new Transaction(agent)
    let mock = null
    let attrs = null

    mock = sinon.mock(transaction)
    mock.expects('hasErrors').returns(true)
    attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    mock.verify()
    mock.restore()
    t.equal(true, attrs.error)

    mock = sinon.mock(transaction)
    mock.expects('hasErrors').returns(false)
    attrs = agent._addIntrinsicAttrsFromTransaction(transaction)
    mock.verify()
    mock.restore()
    t.equal(false, attrs.error)

    t.end()
  })
})

tap.test('when CAT is enabled', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach(() => {
    // App name from test data
    agent = helper.loadMockedAgent({
      apdex_t: 0.05,
      cross_application_tracer: { enabled: true },
      distributed_tracing: { enabled: false }
    })
    agent.config.applications = function newFake() {
      return ['testAppName']
    }
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const expectedDurationsInSeconds = [0.03, 0.15, 0.5]

  crossAgentTests.forEach(function (test, index) {
    t.test(test.name + ' tx event should contain all intrinsic attrs', (t) => {
      const idx = index % expectedDurationsInSeconds.length
      const expectedDuration = expectedDurationsInSeconds[idx]

      const expectedTotalTime = 0.03

      const start = Date.now()
      const trans = getMockTransaction(agent, test, start, expectedDuration, expectedTotalTime)

      const attrs = agent._addIntrinsicAttrsFromTransaction(trans)

      const keys = [
        'duration',
        'name',
        'timestamp',
        'type',
        'totalTime',
        'webDuration',
        'error',
        'nr.guid',
        'nr.pathHash',
        'nr.referringPathHash',
        'nr.tripId',
        'nr.referringTransactionGuid',
        'nr.alternatePathHashes',
        'nr.apdexPerfZone'
      ]

      for (let i = 0; i < test.nonExpectedIntrinsicFields.length; ++i) {
        keys.splice(keys.indexOf(test.nonExpectedIntrinsicFields[i]), 1)
      }

      if (!test.expectedIntrinsicFields['nr.pathHash']) {
        keys.splice(keys.indexOf('nr.apdexPerfZone'), 1)
      }

      chai.expect(Object.keys(attrs)).to.have.members(keys)

      chai.expect(attrs.duration).to.be.closeTo(expectedDuration, 0.001)
      chai.expect(attrs.webDuration).to.be.closeTo(expectedDuration, 0.001)
      chai.expect(attrs.totalTime).to.be.closeTo(expectedTotalTime, 0.001)

      t.equal(attrs.timestamp, start)
      t.equal(attrs.name, test.transactionName)
      t.equal(attrs.type, 'Transaction')
      t.equal(attrs.error, false)
      t.equal(attrs['nr.guid'], test.expectedIntrinsicFields['nr.guid'])
      t.equal(attrs['nr.pathHash'], test.expectedIntrinsicFields['nr.pathHash'])
      t.equal(attrs['nr.referringPathHash'], test.expectedIntrinsicFields['nr.referringPathHash'])
      t.equal(attrs['nr.tripId'], test.expectedIntrinsicFields['nr.tripId'])

      t.equal(
        attrs['nr.referringTransactionGuid'],
        test.expectedIntrinsicFields['nr.referringTransactionGuid']
      )

      t.equal(
        attrs['nr.alternatePathHashes'],
        test.expectedIntrinsicFields['nr.alternatePathHashes']
      )

      if (test.expectedIntrinsicFields['nr.pathHash']) {
        // nr.apdexPerfZone not specified in the test, this is used to exercise it.
        switch (idx) {
          case 0:
            t.equal(attrs['nr.apdexPerfZone'], 'S')
            break
          case 1:
            t.equal(attrs['nr.apdexPerfZone'], 'T')
            break
          case 2:
            t.equal(attrs['nr.apdexPerfZone'], 'F')
            break
        }
      }

      t.end()
    })
  })
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
    cat.assignCatToTransaction(test.inboundPayload[0], test.inboundPayload, transaction)
  } else {
    // Simulate the headers being unparsable or not existing
    cat.assignCatToTransaction(null, null, transaction)
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
