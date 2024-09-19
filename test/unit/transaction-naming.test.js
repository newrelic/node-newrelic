/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../lib/agent_helper')
const API = require('../../api')

test('Transaction naming:', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('Transaction should be named /* without any other naming source', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/*')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('Transaction should not be normalized when 404', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      transaction.nameState.setName('Expressjs', 'GET', '/', null)
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      assert.equal(transaction.name, 'WebTransaction/Expressjs/GET/(not found)')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('Instrumentation should trump default naming', function (t, end) {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/Expressjs/GET//setByInstrumentation')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('API naming should trump default naming', function (t, end) {
    const { agent } = t.nr
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/Custom/override')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('API naming should trump instrumentation naming', function (t, end) {
    const { agent } = t.nr
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/Custom/override')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test(
    'API naming should trump instrumentation naming (order should not matter)',
    function (t, end) {
      const { agent } = t.nr
      const api = new API(agent)
      helper.runInTransaction(agent, function (transaction) {
        api.setTransactionName('override')
        simulateInstrumentation(transaction)
        transaction.finalizeNameFromUri('http://test.test.com/', 200)
        assert.equal(transaction.name, 'WebTransaction/Custom/override')
        assert.equal(
          transaction.name,
          transaction.getFullName(),
          'name should be equal to finalized name'
        )
        end()
      })
    }
  )

  await t.test('API should trump 404', function (t, end) {
    const { agent } = t.nr
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      assert.equal(transaction.name, 'WebTransaction/Custom/override')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('Custom naming rules should trump default naming', function (t, end) {
    const { agent } = t.nr
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test(
    'Server sent naming rules should be applied when user specified rules are set',
    function (t, end) {
      const { agent } = t.nr
      agent.urlNormalizer.addSimple(/\d+/, '*')
      agent.userNormalizer.addSimple(/123/, 'abc')
      helper.runInTransaction(agent, function (transaction) {
        transaction.finalizeNameFromUri('http://test.test.com/123/456', 200)
        assert.equal(transaction.name, 'WebTransaction/NormalizedUri/abc/*')
        assert.equal(
          transaction.name,
          transaction.getFullName(),
          'name should be equal to finalized name'
        )
        end()
      })
    }
  )

  await t.test('Custom naming rules should be cleaned up', function (t, end) {
    const { agent } = t.nr
    agent.userNormalizer.addSimple(/\//, 'test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('Custom naming rules should trump instrumentation naming', function (t, end) {
    const { agent } = t.nr
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      simulateInstrumentation(transaction)
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('API calls should trump Custom naming rules', function (t, end) {
    const { agent } = t.nr
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    const api = new API(agent)
    helper.runInTransaction(agent, function (transaction) {
      api.setTransactionName('override')
      transaction.finalizeNameFromUri('http://test.test.com/', 200)
      assert.equal(transaction.name, 'WebTransaction/Custom/override')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })

  await t.test('Custom naming rules should trump 404', function (t, end) {
    const { agent } = t.nr
    agent.userNormalizer.addSimple(/\//, '/test-transaction')
    helper.runInTransaction(agent, function (transaction) {
      transaction.finalizeNameFromUri('http://test.test.com/', 404)
      assert.equal(transaction.name, 'WebTransaction/NormalizedUri/test-transaction')
      assert.equal(
        transaction.name,
        transaction.getFullName(),
        'name should be equal to finalized name'
      )
      end()
    })
  })
})

function simulateInstrumentation(transaction) {
  transaction.nameState.setName('Expressjs', 'GET', '/', 'setByInstrumentation')
}
