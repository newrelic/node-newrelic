/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const { assertCLMAttrs } = require('../../lib/custom-assertions')
function nested({ api }) {
  api.startWebTransaction('nested', function nestedHandler() {})
}

test('Agent API - startWebTransaction', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.tracer = helper.getTracer()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not throw when transaction cannot be created', (t, end) => {
    const { agent, api } = t.nr
    agent.setState('stopped')
    api.startWebTransaction('test', () => {
      const transaction = agent.tracer.getTransaction()
      assert.ok(!transaction)

      end()
    })
  })

  await t.test('should add nested transaction as segment to parent transaction', (t, end) => {
    const { agent, api, tracer } = t.nr
    let transaction = null

    api.startWebTransaction('test', function () {
      nested({ api })
      transaction = agent.tracer.getTransaction()
      assert.equal(transaction.type, 'web')
      assert.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      assert.ok(transaction.isActive())

      const currentSegment = tracer.getSegment()
      const nestedSegment = currentSegment.children[0]
      assert.equal(nestedSegment.name, 'nested')
    })

    assert.ok(!transaction.isActive())

    end()
  })

  await t.test('should end the transaction after the handle returns by default', (t, end) => {
    const { agent, api } = t.nr
    let transaction = null

    api.startWebTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      assert.equal(transaction.type, 'web')
      assert.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      assert.ok(transaction.isActive())
    })

    assert.ok(!transaction.isActive())
    end()
  })

  await t.test(
    'should end the txn after a promise returned by the txn function resolves',
    (t, end) => {
      const { agent, api } = t.nr
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
        assert.equal(transaction.type, 'web')
        assert.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
        assert.ok(transaction.isActive())

        assert.ok(!thenCalled)
        return FakePromise
      })

      assert.ok(thenCalled)
      assert.ok(!transaction.isActive())

      end()
    }
  )

  await t.test('should not end the txn if the txn is being handled externally', (t, end) => {
    const { agent, api } = t.nr
    let transaction = null

    api.startWebTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      assert.equal(transaction.type, 'web')
      assert.equal(transaction.getFullName(), 'WebTransaction/Custom//test')
      assert.ok(transaction.isActive())

      transaction.handledExternally = true
    })

    assert.ok(transaction.isActive())

    transaction.end()
    end()
  })

  await t.test('should call the handler if no url is supplied', (t, end) => {
    const { agent, api } = t.nr
    let transaction = null

    api.startWebTransaction(null, function () {
      transaction = agent.tracer.getTransaction()
      assert.ok(!transaction)

      end()
    })
  })

  await t.test('should not throw when no handler is supplied', (t, end) => {
    const { api } = t.nr
    // should not throw
    assert.doesNotThrow(() => {
      api.startWebTransaction('test')
    })

    end()
  })

  const clmEnabled = [true, false]
  await Promise.all(
    clmEnabled.map(async (enabled) => {
      await t.test(`should ${enabled ? 'add' : 'not add'} CLM attributes to segment`, (t, end) => {
        const { agent, api } = t.nr
        agent.config.code_level_metrics.enabled = enabled
        api.startWebTransaction('clm-tx', function handler() {
          const segment = api.shim.getSegment()
          assertCLMAttrs({
            segments: [
              {
                segment,
                name: 'handler',
                filepath: 'test/unit/api/api-start-web-transaction.test.js'
              }
            ],
            enabled
          })
          end()
        })
      })

      await t.test(
        `should ${enabled ? 'add' : 'not add'} CLM attributes to nested web transactions`,
        (t, end) => {
          const { agent, api, tracer } = t.nr
          agent.config.code_level_metrics.enabled = enabled
          api.startWebTransaction('clm-nested-test', function () {
            nested({ api })
            const currentSegment = tracer.getSegment()
            const nestedSegment = currentSegment.children[0]
            assertCLMAttrs({
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

          end()
        }
      )
    })
  )
})
