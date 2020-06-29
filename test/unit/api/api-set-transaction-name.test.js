/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - setTranasactionName', (t) => {
  t.autoend()

  let agent = null
  let api = null

  const TEST_URL = '/test/path/31337'
  const NAME = 'WebTransaction/Uri/test/path/31337'

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test("exports a transaction naming function", (t) => {
    t.ok(api.setTransactionName)
    t.type(api.setTransactionName, 'function')

    t.end()
  })

  t.test("sets the transaction name to the custom name", (t) => {
    setTranasactionNameGoldenPath((transaction) => {
      t.equal(transaction.name, 'WebTransaction/Custom/Test')
      t.end()
    })
  })

  t.test("names the web trace segment after the custom name", (t) => {
    setTranasactionNameGoldenPath((transaction, segment) => {
      t.equal(segment.name, 'WebTransaction/Custom/Test')
      t.end()
    })
  })

  t.test("leaves the request URL alone", (t) => {
    setTranasactionNameGoldenPath((transaction) => {
      t.equal(transaction.url, TEST_URL)
      t.end()
    })
  })

  t.test("uses the last name set when called multiple times", (t) => {
    agent.on('transactionFinished', function(transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.name, 'WebTransaction/Custom/List')

      t.end()
    })

    helper.runInTransaction(agent, function(transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
      api.setTransactionName('Index')
      api.setTransactionName('Update')
      api.setTransactionName('Delete')
      api.setTransactionName('List')

      transaction.end()
    })
  })

  function setTranasactionNameGoldenPath(cb) {
    let segment = null

    agent.on('transactionFinished', function(finishedTransaction) {
      finishedTransaction.finalizeNameFromUri(TEST_URL, 200)
      segment.markAsWeb(TEST_URL)
      cb(finishedTransaction, segment)
    })

    helper.runInTransaction(agent, function(tx) {
      // grab segment
      agent.tracer.addSegment(NAME, null, null, false, function() {
        // HTTP instrumentation sets URL as soon as it knows it
        segment = agent.tracer.getSegment()
        tx.type = 'web'
        tx.url = TEST_URL
        tx.verb = 'POST'

        // Name the transaction
        api.setTransactionName('Test')

        tx.end()
      })
    })
  }
})
