/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../lib/agent_helper')
const API = require('../../api')
const { test } = require('tap')

test('Transaction naming:', function (t) {
  t.autoend()
  let agent

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
  })

  t.test('Transaction should be named /* without any other naming source', function (t) {
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/NormalizedUri/*')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('Transaction should not be normalized when 404', function (t) {
    helper.runInTransaction(agent, function (transaction) {
      transaction.nameState.setName('Expressjs', 'GET', '/', null)
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      t.equal(transaction.name, 'WebTransaction/Expressjs/GET/(not found)')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('Instrumentation should trump default naming', function (t) {
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/Expressjs/GET//setByInstrumentation')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('API naming should trump default naming', function (t) {
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/Custom/override')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('API naming should trump instrumentation naming', function (t) {
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/Custom/override')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('API naming should trump instrumentation naming (order should not matter)', function (t) {
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/Custom/override')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('API should trump 404', function (t) {
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      t.equal(transaction.name, 'WebTransaction/Custom/override')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('Custom naming rules should trump default naming', function (t) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test(
    'Server sent naming rules should be applied when user specified rules are set',
    function (t) {
      agent.urlNormalizer.addSimple(/\d+/, '*')
      agent.userNormalizer.addSimple(/123/, 'abc')
      helper.runInTransaction(agent, function (transaction) {
        transaction.finalizeNameFromUri('http://test.test.com/123/456', 200)
        t.equal(transaction.name, 'WebTransaction/NormalizedUri/abc/*')
        t.equal(
          transaction.name,
          transaction.getFullName(),
          'name should be equal to finalized name'
        )
        t.end()
      })
    }
  )

  t.test('Custom naming rules should be cleaned up', function (t) {
    agent.userNormalizer.addSimple(/\//, 'test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('Custom naming rules should trump instrumentation naming', function (t) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('API calls should trump Custom naming rules', function (t) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      t.equal(transaction.name, 'WebTransaction/Custom/override')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })

  t.test('Custom naming rules should trump 404', function (t) {
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      t.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      t.equal(transaction.name, transaction.getFullName(), 'name should be equal to finalized name')
      t.end()
    })
  })
})

function simulateInstrumentation(transaction) {
  transaction.nameState.setName('Expressjs', 'GET', '/', 'setByInstrumentation')
}
