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
    t.context.api.agent.config.ai_monitoring.enabled = true
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.api.agent)
  })

  t.test('getLlmMessageIds is no-op when ai_monitoring is disabled', async (t) => {
    const { api } = t.context
    api.agent.config.ai_monitoring.enabled = false

    const trackedIds = api.getLlmMessageIds({ responseId: 'test' })
    t.equal(trackedIds, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(loggerMock.warn.args[0][0], 'getLlmMessageIds invoked but ai_monitoring is disabled.')
  })

  t.test('geLlmMessageIds is no-op when no transaction is available', async (t) => {
    const { api } = t.context
    const trackedIds = api.getLlmMessageIds({ responseId: 'test' })
    t.equal(trackedIds, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'getLlmMessageIds must be called within the scope of a transaction.'
    )
  })

  t.test('getLlmMessageIds returns undefined for unrecognized id', async (t) => {
    const { api } = t.context
    helper.runInTransaction(api.agent, () => {
      const trackedIds = api.getLlmMessageIds({ responseId: 'test' })
      t.equal(trackedIds, undefined)
      t.equal(loggerMock.warn.callCount, 0)
    })
  })

  t.test('recordLlmFeedbackEvent is no-op when ai_monitoring is disabled', async (t) => {
    const { api } = t.context
    api.agent.config.ai_monitoring.enabled = false

    const result = api.recordLlmFeedbackEvent({
      messageId: 'test',
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
      messageId: 'test',
      category: 'test',
      rating: 'test'
    })
    t.equal(result, undefined)
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'No message feedback events will be recorded. recordLlmFeedbackEvent must be called within the scope of a transaction.'
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
        messageId: 'test',
        category: 'test-cat',
        rating: '5 star',
        metadata: { foo: 'foo' }
      })
      t.equal(result, undefined)
      t.equal(loggerMock.warn.callCount, 0)
      t.equal(event.name, 'LlmFeedbackMessage')
      t.match(event.data, {
        id: /[\w\d]{32}/,
        conversation_id: '',
        request_id: '',
        message_id: 'test',
        category: 'test-cat',
        rating: '5 star',
        message: '',
        foo: 'foo',
        ingest_source: 'Node'
      })
    })
  })
})
