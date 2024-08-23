/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')

test('Agent API LLM methods', async (t) => {
  const loggerMock = require('../mocks/logger')()
  const API = proxyquire('../../../api', {
    './lib/logger': {
      child: sinon.stub().callsFake(() => loggerMock)
    }
  })

  t.beforeEach((ctx) => {
    ctx.nr = {}
    loggerMock.warn.reset()
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    agent.config.ai_monitoring.enabled = true
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('recordLlmFeedbackEvent is no-op when no traceId is provided', async (t) => {
    const { api } = t.nr

    await helper.runInTransaction(api.agent, () => {
      const result = api.recordLlmFeedbackEvent({
        category: 'test',
        rating: 'test'
      })
      assert.equal(result, undefined)
      assert.equal(loggerMock.warn.callCount, 1)
      assert.equal(
        loggerMock.warn.args[0][0],
        'A feedback event will not be recorded.  recordLlmFeedbackEvent must be called with a traceId.'
      )
    })
  })

  await t.test('recordLlmFeedbackEvent is no-op when ai_monitoring is disabled', async (t) => {
    const { api } = t.nr
    api.agent.config.ai_monitoring.enabled = false

    const result = api.recordLlmFeedbackEvent({
      traceId: 'trace-id',
      category: 'test',
      rating: 'test'
    })
    assert.equal(result, undefined)
    assert.equal(loggerMock.warn.callCount, 1)
    assert.equal(
      loggerMock.warn.args[0][0],
      'recordLlmFeedbackEvent invoked but ai_monitoring is disabled.'
    )
  })

  await t.test('recordLlmFeedbackEvent is no-op when no transaction is available', async (t) => {
    const { api } = t.nr

    const result = api.recordLlmFeedbackEvent({
      traceId: 'trace-id',
      category: 'test',
      rating: 'test'
    })
    assert.equal(result, undefined)
    assert.equal(loggerMock.warn.callCount, 1)
    assert.equal(
      loggerMock.warn.args[0][0],
      'A feedback events will not be recorded. recordLlmFeedbackEvent must be called within the scope of a transaction.'
    )
  })

  await t.test('recordLlmFeedbackEvent returns undefined on success', async (t) => {
    const { api } = t.nr

    const rce = api.recordCustomEvent
    let event
    api.recordCustomEvent = (name, data) => {
      event = { name, data }
      return rce.call(api, name, data)
    }
    t.after(() => {
      api.recordCustomEvent = rce
    })

    await helper.runInTransaction(api.agent, () => {
      const result = api.recordLlmFeedbackEvent({
        traceId: 'trace-id',
        category: 'test-cat',
        rating: '5 star',
        metadata: { foo: 'foo' }
      })
      assert.equal(result, undefined)
      assert.equal(loggerMock.warn.callCount, 0)
      assert.equal(event.name, 'LlmFeedbackMessage')
      assert.match(event.data.id, /[\w\d]{32}/)
      // remove from object as it was just asserted via regex
      delete event.data.id
      assert.deepEqual(event.data, {
        trace_id: 'trace-id',
        category: 'test-cat',
        rating: '5 star',
        message: '',
        foo: 'foo',
        ingest_source: 'Node'
      })
    })
  })

  await t.test('withLlmCustomAttributes should handle no active transaction', (t, end) => {
    const { api } = t.nr
    assert.equal(
      api.withLlmCustomAttributes({ test: 1 }, () => {
        assert.equal(loggerMock.warn.callCount, 1)
        return 1
      }),
      1
    )
    end()
  })

  await t.test('withLlmCustomAttributes should handle an empty store', (t, end) => {
    const { api } = t.nr
    const agent = api.agent

    helper.runInTransaction(api.agent, (tx) => {
      agent.tracer.getTransaction = () => {
        return tx
      }
      assert.equal(
        api.withLlmCustomAttributes(null, () => {
          return 1
        }),
        1
      )
      end()
    })
  })

  await t.test('withLlmCustomAttributes should handle no callback', (t, end) => {
    const { api } = t.nr
    const agent = api.agent
    helper.runInTransaction(api.agent, (tx) => {
      agent.tracer.getTransaction = () => {
        return tx
      }
      api.withLlmCustomAttributes({ test: 1 }, null)
      assert.equal(loggerMock.warn.callCount, 1)
      end()
    })
  })

  await t.test('withLlmCustomAttributes should normalize attributes', (t, end) => {
    const { api } = t.nr
    const agent = api.agent
    helper.runInTransaction(api.agent, (tx) => {
      agent.tracer.getTransaction = () => {
        return tx
      }
      api.withLlmCustomAttributes(
        {
          'toRename': 'value1',
          'llm.number': 1,
          'llm.boolean': true,
          'toDelete': () => {},
          'toDelete2': {},
          'toDelete3': []
        },
        () => {
          const contextManager = tx._llmContextManager
          const parentContext = contextManager.getStore()
          assert.equal(parentContext['llm.toRename'], 'value1')
          assert.ok(!parentContext.toDelete)
          assert.ok(!parentContext.toDelete2)
          assert.ok(!parentContext.toDelete3)
          assert.equal(parentContext['llm.number'], 1)
          assert.equal(parentContext['llm.boolean'], true)
          end()
        }
      )
    })
  })

  await t.test('withLlmCustomAttributes should support branching', (t, end) => {
    const { api } = t.nr
    const agent = api.agent

    helper.runInTransaction(api.agent, (tx) => {
      agent.tracer.getTransaction = () => {
        return tx
      }
      api.withLlmCustomAttributes(
        { 'llm.step': '1', 'llm.path': 'root', 'llm.name': 'root' },
        () => {
          const contextManager = tx._llmContextManager
          const context = contextManager.getStore()
          assert.equal(context[`llm.step`], '1')
          assert.equal(context['llm.path'], 'root')
          assert.equal(context['llm.name'], 'root')
          api.withLlmCustomAttributes({ 'llm.step': '1.1', 'llm.path': 'root/1' }, () => {
            const contextManager2 = tx._llmContextManager
            const context2 = contextManager2.getStore()
            assert.equal(context2[`llm.step`], '1.1')
            assert.equal(context2['llm.path'], 'root/1')
            assert.equal(context2['llm.name'], 'root')
          })
          api.withLlmCustomAttributes({ 'llm.step': '1.2', 'llm.path': 'root/2' }, () => {
            const contextManager3 = tx._llmContextManager
            const context3 = contextManager3.getStore()
            assert.equal(context3[`llm.step`], '1.2')
            assert.equal(context3['llm.path'], 'root/2')
            assert.equal(context3['llm.name'], 'root')
            end()
          })
        }
      )
    })
  })

  await t.test('setLlmTokenCount should register callback to calculate token counts', async (t) => {
    const { api, agent } = t.nr
    function callback(model, content) {
      if (model === 'foo' && content === 'bar') {
        return 10
      }

      return 1
    }
    api.setLlmTokenCountCallback(callback)
    assert.deepEqual(agent.llm.tokenCountCallback, callback)
  })

  await t.test('should not store token count callback if it is async', async (t) => {
    const { api, agent } = t.nr
    async function callback(model, content) {
      return await new Promise((resolve) => {
        if (model === 'foo' && content === 'bar') {
          resolve(10)
        }
      })
    }
    api.setLlmTokenCountCallback(callback)
    assert.deepEqual(agent.llm.tokenCountCallback, undefined)
    assert.equal(loggerMock.warn.callCount, 1)
    assert.equal(
      loggerMock.warn.args[0][0],
      'Llm token count callback must be a synchronous function, callback will not be registered.'
    )
  })

  await t.test(
    'should not store token count callback if callback is not actually a function',
    async (t) => {
      const { api, agent } = t.nr
      api.setLlmTokenCountCallback({ unit: 'test' })
      assert.deepEqual(agent.llm.tokenCountCallback, undefined)
      assert.equal(loggerMock.warn.callCount, 1)
      assert.equal(
        loggerMock.warn.args[0][0],
        'Llm token count callback must be a synchronous function, callback will not be registered.'
      )
    }
  )
})
