/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const { assertCLMAttrs, assertSpanKind } = require('../../lib/custom-assertions')

function nested({ api }) {
  api.startBackgroundTransaction('nested', function nestedHandler() {})
}

test('Agent API - startBackgroundTransaction', async (t) => {
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
    api.startBackgroundTransaction('test', () => {
      const transaction = agent.tracer.getTransaction()
      assert.ok(!transaction)

      end()
    })
  })

  await t.test('should add nested transaction as segment to parent transaction', (t, end) => {
    const { agent, api, tracer } = t.nr
    let transaction = null

    api.startBackgroundTransaction('test', function () {
      nested({ api })
      transaction = agent.tracer.getTransaction()

      assert.equal(transaction.type, 'bg')
      assert.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      assert.ok(transaction.isActive())

      const currentSegment = tracer.getSegment()
      const [nestedSegment] = transaction.trace.getChildren(currentSegment.id)
      assert.equal(nestedSegment.name, 'Nodejs/nested')
    })

    assert.ok(!transaction.isActive())

    end()
  })

  await t.test('should end the transaction after the handle returns by default', (t, end) => {
    const { agent, api } = t.nr
    let transaction = null

    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      assert.equal(transaction.type, 'bg')
      assert.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      assert.ok(transaction.isActive())
    })

    assert.ok(!transaction.isActive())
    assertSpanKind({ agent, segments: [{ name: transaction.name, kind: 'server' }] })

    end()
  })

  await t.test('should be namable with setTransactionName', (t, end) => {
    const { agent, api } = t.nr
    let handle = null
    let transaction = null
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      handle = api.getTransaction()
      api.setTransactionName('custom name')

      assert.equal(transaction.type, 'bg')
      assert.equal(transaction.getFullName(), 'OtherTransaction/Custom/custom name')
      assert.ok(transaction.isActive())
    })

    process.nextTick(function () {
      handle.end()

      assert.ok(!transaction.isActive())
      assert.equal(transaction.getFullName(), 'OtherTransaction/Custom/custom name')

      end()
    })
  })

  await t.test(
    'should start a background txn with the given name as the name and group',
    (t, end) => {
      const { agent, api } = t.nr
      let transaction = null
      api.startBackgroundTransaction('test', 'group', function () {
        transaction = agent.tracer.getTransaction()
        assert.ok(transaction)

        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), 'OtherTransaction/group/test')
        assert.ok(transaction.isActive())
      })

      assert.ok(!transaction.isActive())

      end()
    }
  )

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
      api.startBackgroundTransaction('test', function () {
        transaction = agent.tracer.getTransaction()

        assert.equal(transaction.type, 'bg')
        assert.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
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
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()

      assert.equal(transaction.type, 'bg')
      assert.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      assert.ok(transaction.isActive())

      transaction.handledExternally = true
    })

    assert.ok(transaction.isActive())

    transaction.end()
    end()
  })

  await t.test('should call the handler if no name is supplied', (t, end) => {
    const { agent, api } = t.nr
    api.startBackgroundTransaction(null, function () {
      const transaction = agent.tracer.getTransaction()
      assert.ok(!transaction)

      end()
    })
  })

  await t.test('should record metrics', (t, end) => {
    const { agent, api } = t.nr
    let transaction
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
    })

    transaction.end()
    const metrics = transaction.metrics.unscoped
    ;[
      'OtherTransaction/Nodejs/test',
      'OtherTransactionTotalTime/Nodejs/test',
      'OtherTransaction/all',
      'OtherTransactionTotalTime',
      'OtherTransactionTotalTime',
      'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all',
      'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allOther'
    ].forEach((metric) => {
      assert.ok(metrics[metric].total, `${metric} has total`)
      assert.ok(metrics[metric].totalExclusive, `${metric} has totalExclusive`)
    })

    end()
  })

  await t.test('should not throw when no handler is supplied', (t, end) => {
    const { api } = t.nr
    assert.doesNotThrow(() => api.startBackgroundTransaction('test'))
    assert.doesNotThrow(() => api.startBackgroundTransaction('test', 'asdf'))
    assert.doesNotThrow(() => api.startBackgroundTransaction('test', 'asdf', 'not a function'))

    end()
  })

  const clmEnabled = [true, false]
  await Promise.all(
    clmEnabled.map(async (enabled) => {
      await t.test(`should ${enabled ? 'add' : 'not add'} CLM attributes to segment`, (t, end) => {
        const { agent, api } = t.nr
        agent.config.code_level_metrics.enabled = enabled
        api.startBackgroundTransaction('clm-tx', function handler() {
          const segment = api.shim.getSegment()
          assertCLMAttrs({
            segments: [
              {
                segment,
                name: 'handler',
                filepath: 'test/unit/api/api-start-background-transaction.test.js'
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
          api.startBackgroundTransaction('nested-clm-test', function () {
            nested({ api })
            const currentSegment = tracer.getSegment()
            const transaction = agent.tracer.getTransaction()
            const [nestedSegment] = transaction.trace.getChildren(currentSegment.id)
            assertCLMAttrs({
              segments: [
                {
                  segment: currentSegment,
                  name: '(anonymous)',
                  filepath: 'test/unit/api/api-start-background-transaction.test.js'
                },
                {
                  segment: nestedSegment,
                  name: 'nestedHandler',
                  filepath: 'test/unit/api/api-start-background-transaction.test.js'
                }
              ],
              enabled
            })
            end()
          })
        }
      )
    })
  )

  await t.test('should allow nesting startBackgroundTransaction', function(t, end) {
    const { api, tracer } = t.nr
    let called = false
    function bg() {
      if (!called) {
        called = true
        setTimeout(() => {
          wrap('second')
        }, 10)
      } else {
        end()
      }
    }

    function wrap(name) {
      api.startBackgroundTransaction(name, () => {
        const tx = tracer.getTransaction()
        assert.ok(tx._partialName, `Nodejs/${name}`)
        bg()
      })
    }
    wrap('first')
  })
})
