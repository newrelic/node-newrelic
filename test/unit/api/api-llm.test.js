/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const helper = require('../../lib/agent_helper')

tap.test('Agent API LLM methods', (t) => {
  t.autoend()
  let loggerMock
  let API

  t.before(() => {
    loggerMock = require('../mocks/logger')()
    API = proxyquire('../../../api', {
      './lib/logger': {
        child: sinon.stub().callsFake(() => loggerMock)
      }
    })
  })

  t.beforeEach((t) => {
    loggerMock.warn.reset()
    const agent = helper.loadMockedAgent()
    t.context.api = new API(agent)
    agent.config.ai_monitoring.enabled = true
    t.context.agent = agent
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.api.agent)
  })

  t.test('recordLlmFeedbackEvent is no-op when no traceId is provided', async (t) => {
    const { api } = t.context

    helper.runInTransaction(api.agent, () => {
      const result = api.recordLlmFeedbackEvent({
        category: 'test',
        rating: 'test'
      })
      t.equal(result, undefined)
      t.equal(loggerMock.warn.callCount, 1)
      t.equal(
        loggerMock.warn.args[0][0],
        'A feedback event will not be recorded.  recordLlmFeedbackEvent must be called with a traceId.'
      )
    })
  })

  t.test('recordLlmFeedbackEvent is no-op when ai_monitoring is disabled', async (t) => {
    const { api } = t.context
    api.agent.config.ai_monitoring.enabled = false

    const result = api.recordLlmFeedbackEvent({
      traceId: 'trace-id',
      category: 'test',
      rating: 'test'
    })
    t.equal(result, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'recordLlmFeedbackEvent invoked but ai_monitoring is disabled.'
    )
  })

  t.test('recordLlmFeedbackEvent is no-op when no transaction is available', async (t) => {
    const { api } = t.context

    const result = api.recordLlmFeedbackEvent({
      traceId: 'trace-id',
      category: 'test',
      rating: 'test'
    })
    t.equal(result, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'A feedback events will not be recorded. recordLlmFeedbackEvent must be called within the scope of a transaction.'
    )
  })

  t.test('recordLlmFeedbackEvent returns undefined on success', async (t) => {
    const { api } = t.context

    const rce = api.recordCustomEvent
    let event
    api.recordCustomEvent = (name, data) => {
      event = { name, data }
      return rce.call(api, name, data)
    }
    t.teardown(() => {
      api.recordCustomEvent = rce
    })

    helper.runInTransaction(api.agent, () => {
      const result = api.recordLlmFeedbackEvent({
        traceId: 'trace-id',
        category: 'test-cat',
        rating: '5 star',
        metadata: { foo: 'foo' }
      })
      t.equal(result, undefined)
      t.equal(loggerMock.warn.callCount, 0)
      t.equal(event.name, 'LlmFeedbackMessage')
      t.match(event.data, {
        id: /[\w\d]{32}/,
        trace_id: 'trace-id',
        category: 'test-cat',
        rating: '5 star',
        message: '',
        foo: 'foo',
        ingest_source: 'Node'
      })
    })
  })

  t.test('setLlmTokenCount should register callback to calculate token counts', async (t) => {
    const { api, agent } = t.context
    function callback(model, content) {
      if (model === 'foo' && content === 'bar') {
        return 10
      }

      return 1
    }
    api.setLlmTokenCountCallback(callback)
    t.same(agent.llm.tokenCountCallback, callback)
  })

  t.test('should not store token count callback if it is async', async (t) => {
    const { api, agent } = t.context
    async function callback(model, content) {
      return await new Promise((resolve) => {
        if (model === 'foo' && content === 'bar') {
          resolve(10)
        }
      })
    }
    api.setLlmTokenCountCallback(callback)
    t.same(agent.llm.tokenCountCallback, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'Llm token count callback must be a synchronous function, callback will not be registered.'
    )
  })

  t.test(
    'should not store token count callback if callback is not actually a function',
    async (t) => {
      const { api, agent } = t.context
      api.setLlmTokenCountCallback({ unit: 'test' })
      t.same(agent.llm.tokenCountCallback, undefined)
      t.equal(loggerMock.warn.callCount, 1)
      t.equal(
        loggerMock.warn.args[0][0],
        'Llm token count callback must be a synchronous function, callback will not be registered.'
      )
    }
  )
})
