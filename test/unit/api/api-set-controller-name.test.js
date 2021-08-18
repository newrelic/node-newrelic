/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - setControllerName', (t) => {
  t.autoend()

  const TEST_URL = '/test/path/31337'
  const NAME = 'WebTransaction/Uri/test/path/31337'

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('exports a controller naming function', (t) => {
    t.ok(api.setControllerName)
    t.type(api.setControllerName, 'function')

    t.end()
  })

  t.test('sets the controller in the transaction name', (t) => {
    goldenPathRenameControllerInTransaction((transaction) => {
      t.equal(transaction.name, 'WebTransaction/Controller/Test/POST')
      t.end()
    })
  })

  t.test('names the web trace segment after the controller', (t) => {
    goldenPathRenameControllerInTransaction((transaction, segment) => {
      t.equal(segment.name, 'WebTransaction/Controller/Test/POST')
      t.end()
    })
  })

  t.test('leaves the request URL alone', (t) => {
    goldenPathRenameControllerInTransaction((transaction) => {
      t.equal(transaction.url, TEST_URL)
      t.end()
    })
  })

  t.test('uses the HTTP verb for the default action', (t) => {
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)
      t.equal(transaction.name, 'WebTransaction/Controller/Test/DELETE')

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL

      // SET THE ACTION
      transaction.verb = 'DELETE'

      // NAME THE CONTROLLER
      api.setControllerName('Test')

      transaction.end()
    })
  })

  t.test('allows a custom action', (t) => {
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.name, 'WebTransaction/Controller/Test/index')

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION
      api.setControllerName('Test', 'index')

      transaction.end()
    })
  })

  t.test('uses the last controller set when called multiple times', (t) => {
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.name, 'WebTransaction/Controller/Test/list')

      t.end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
      api.setControllerName('Test', 'index')
      api.setControllerName('Test', 'update')
      api.setControllerName('Test', 'delete')
      api.setControllerName('Test', 'list')

      transaction.end()
    })
  })

  function goldenPathRenameControllerInTransaction(cb) {
    let segment = null
    agent.on('transactionFinished', function (finishedTransaction) {
      finishedTransaction.finalizeNameFromUri(TEST_URL, 200)
      segment.markAsWeb(TEST_URL)

      cb(finishedTransaction, segment)
    })

    helper.runInTransaction(agent, function (tx) {
      // grab segment
      agent.tracer.addSegment(NAME, null, null, false, function () {
        // HTTP instrumentation sets URL as soon as it knows it
        segment = agent.tracer.getSegment()
        tx.url = TEST_URL
        tx.verb = 'POST'

        // NAME THE CONTROLLER
        api.setControllerName('Test')

        tx.end()
      })
    })
  }
})
