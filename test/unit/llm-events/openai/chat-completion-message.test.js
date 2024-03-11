/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmChatCompletionMessage = require('../../../../lib/llm-events/openai/chat-completion-message')
const helper = require('../../../lib/agent_helper')
const { req, chatRes, getExpectedResult } = require('./common')

tap.test('LlmChatCompletionMessage', (t) => {
  let agent
  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should create a LlmChatCompletionMessage event', (t) => {
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, (tx) => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        const summaryId = 'chat-summary-id'
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          completionId: summaryId,
          message: req.messages[0],
          index: 0
        })
        const expected = getExpectedResult(tx, { id: 'res-id-0' }, 'message', summaryId)
        t.same(chatMessageEvent, expected)
        t.end()
      })
    })
  })

  t.test('should create a LlmChatCompletionMessage from response choices', (t) => {
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, (tx) => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        const summaryId = 'chat-summary-id'
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          completionId: summaryId,
          message: chatRes.choices[0].message,
          index: 2
        })
        const expected = getExpectedResult(tx, { id: 'res-id-2' }, 'message', summaryId)
        expected.sequence = 2
        expected.content = chatRes.choices[0].message.content
        expected.role = chatRes.choices[0].message.role
        expected.is_response = true
        t.same(chatMessageEvent, expected)
        t.end()
      })
    })
  })

  t.test('should set conversation_id from custom attributes', (t) => {
    const api = helper.getAgentApi()
    const conversationId = 'convo-id'
    helper.runInTransaction(agent, () => {
      api.addCustomAttribute('llm.conversation_id', conversationId)
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment: {},
        request: {},
        response: {}
      })
      t.equal(chatMessageEvent['llm.conversation_id'], conversationId)
      t.end()
    })
  })

  t.test('respects record_content', (t) => {
    const api = helper.getAgentApi()
    const conversationId = 'convo-id'
    agent.config.ai_monitoring.record_content.enabled = false

    helper.runInTransaction(agent, () => {
      api.addCustomAttribute('llm.conversation_id', conversationId)
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment: {},
        request: {},
        response: {}
      })
      t.equal(chatMessageEvent.content, undefined)
      t.end()
    })
  })

  t.test('should use token_count from tokenCountCallback for prompt message', (t) => {
    const api = helper.getAgentApi()
    const expectedCount = 4
    function cb(model, content) {
      t.equal(model, 'gpt-3.5-turbo-0613')
      t.equal(content, 'What is a woodchuck?')
      return expectedCount
    }
    api.setLlmTokenCountCallback(cb)
    helper.runInTransaction(agent, () => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        const summaryId = 'chat-summary-id'
        delete chatRes.usage
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          completionId: summaryId,
          message: req.messages[0],
          index: 0
        })
        t.equal(chatMessageEvent.token_count, expectedCount)
        t.end()
      })
    })
  })

  t.test('should use token_count from tokenCountCallback for completion messages', (t) => {
    const api = helper.getAgentApi()
    const expectedCount = 4
    function cb(model, content) {
      t.equal(model, 'gpt-3.5-turbo-0613')
      t.equal(content, 'a lot')
      return expectedCount
    }
    api.setLlmTokenCountCallback(cb)
    helper.runInTransaction(agent, () => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        const summaryId = 'chat-summary-id'
        delete chatRes.usage
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          completionId: summaryId,
          message: chatRes.choices[0].message,
          index: 2
        })
        t.equal(chatMessageEvent.token_count, expectedCount)
        t.end()
      })
    })
  })

  t.test('should not set token_count if not set in usage nor a callback registered', (t) => {
    const api = helper.getAgentApi()
    helper.runInTransaction(agent, () => {
      api.startSegment('fakeSegment', false, () => {
        const segment = api.shim.getActiveSegment()
        const summaryId = 'chat-summary-id'
        delete chatRes.usage
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          completionId: summaryId,
          message: chatRes.choices[0].message,
          index: 2
        })
        t.equal(chatMessageEvent.token_count, undefined)
        t.end()
      })
    })
  })

  t.test(
    'should not set token_count if not set in usage nor a callback registered returns count',
    (t) => {
      const api = helper.getAgentApi()
      function cb() {
        // empty cb
      }
      api.setLlmTokenCountCallback(cb)
      helper.runInTransaction(agent, () => {
        api.startSegment('fakeSegment', false, () => {
          const segment = api.shim.getActiveSegment()
          const summaryId = 'chat-summary-id'
          delete chatRes.usage
          const chatMessageEvent = new LlmChatCompletionMessage({
            agent,
            segment,
            request: req,
            response: chatRes,
            completionId: summaryId,
            message: chatRes.choices[0].message,
            index: 2
          })
          t.equal(chatMessageEvent.token_count, undefined)
          t.end()
        })
      })
    }
  )

  t.end()
})
