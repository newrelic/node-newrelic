/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - startWebTransaction', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    contextManager = helper.getContextManager()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    contextManager = null
  })

  /**
   * Helper run a web transaction within an existing one
   */
  function nested() {
    api.startWebTransaction('nested', function nestedHandler() {})
  }

  t.test('should not throw when transaction cannot be created', (t) => {
    agent.setState('stopped')
    api.startWebTransaction('test', () => {
      const transaction = agent.tracer.getTransaction()
      t.notOk(transaction)

      t.end()
    })
  })

  t.test('should add nested transaction as segment to parent transaction', (t) => {
    let transaction = null

    api.startWebTransaction('test', function () {
      nested()
      transaction = agent.tracer.getTransaction()
      t.equal(transaction.type, 'web')
      t.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      t.ok(transaction.isActive())

      const currentSegment = contextManager.getContext()
      const nestedSegment = currentSegment.children[0]
      t.equal(nestedSegment.name, 'nested')
    })

    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should end the transaction after the handle returns by default', (t) => {
    let transaction = null

    api.startWebTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      t.equal(transaction.type, 'web')
      t.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      t.ok(transaction.isActive())
    })

    t.notOk(transaction.isActive())
    t.end()
  })

  t.test('should end the txn after a promise returned by the txn function resolves', (t) => {
    let thenCalled = false
    const FakePromise = {
      then: function (f) {
        thenCalled = true
        f()
        return this
      }
    }

    let transaction = null

    api.startWebTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      t.equal(transaction.type, 'web')
      t.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      t.ok(transaction.isActive())

      t.notOk(thenCalled)
      return FakePromise
    })

    t.ok(thenCalled)
    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should not end the txn if the txn is being handled externally', (t) => {
    let transaction = null

    api.startWebTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      t.equal(transaction.type, 'web')
      t.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      t.ok(transaction.isActive())

      transaction.handledExternally = true
    })

    t.ok(transaction.isActive())

    transaction.end()
    t.end()
  })

  t.test('should call the handler if no url is supplied', (t) => {
    let transaction = null

    api.startWebTransaction(null, function () {
      transaction = agent.tracer.getTransaction()
      t.notOk(transaction)

      t.end()
    })
  })

  t.test('should not throw when no handler is supplied', (t) => {
    // should not throw
    api.startWebTransaction('test')

    t.end()
  })

  const clmEnabled = [true, false]
  clmEnabled.forEach((enabled) => {
    t.test(`should ${enabled ? 'add' : 'not add'} CLM attributes to segment`, (t) => {
      agent.config.code_level_metrics.enabled = enabled
      api.startWebTransaction('clm-tx', function handler() {
        const segment = api.shim.getSegment()
        t.clmAttrs({
          segments: [
            {
              segment,
              name: 'handler',
              filepath: 'test/unit/api/api-start-web-transaction.test.js'
            }
          ],
          enabled
        })
        t.end()
      })
    })

    t.test(
      `should ${enabled ? 'add' : 'not add'} CLM attributes to nested web transactions`,
      (t) => {
        agent.config.code_level_metrics.enabled = enabled
        api.startWebTransaction('clm-nested-test', function () {
          nested()
          const currentSegment = contextManager.getContext()
          const nestedSegment = currentSegment.children[0]
          t.clmAttrs({
            segments: [
              {
                segment: currentSegment,
                name: '(anonymous)',
                filepath: 'test/unit/api/api-start-web-transaction.test.js'
              },
              {
                segment: nestedSegment,
                name: 'nestedHandler',
                filepath: 'test/unit/api/api-start-web-transaction.test.js'
              }
            ],
            enabled
          })
        })

        t.end()
      }
    )
  })
})
