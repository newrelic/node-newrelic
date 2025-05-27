/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmChatCompletionMessage = require('../../../../lib/llm-events/google-genai/chat-completion-message')
const helper = require('../../../lib/agent_helper')
const { req, res, getExpectedResult } = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create a LlmChatCompletionMessage event', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: req,
        response: res,
        completionId: summaryId,
        message: req.contents,
        index: 0
      })
      const expected = getExpectedResult(tx, chatMessageEvent, 'message', summaryId)
      assert.deepEqual(chatMessageEvent, expected)
      end()
    })
  })
})

test('should create a LlmChatCompletionMessage from response choices', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: req,
        response: res,
        completionId: summaryId,
        message: res.candidates[0].content,
        index: 2
      })
      const expected = getExpectedResult(tx, chatMessageEvent, 'message', summaryId)
      expected.sequence = 2
      expected.content = res.candidates[0].content.parts[0].text
      expected.role = res.candidates[0].content.role
      expected.is_response = true
      assert.deepEqual(chatMessageEvent, expected)
      end()
    })
  })
})

test('should set conversation_id from custom attributes', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const conversationId = 'convo-id'
  helper.runInTransaction(agent, () => {
    api.addCustomAttribute('llm.conversation_id', conversationId)
    const chatMessageEvent = new LlmChatCompletionMessage({
      transaction: {},
      agent,
      segment: {},
      request: {},
      response: {}
    })
    assert.equal(chatMessageEvent['llm.conversation_id'], conversationId)
    end()
  })
})

test('respects record_content', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const conversationId = 'convo-id'
  agent.config.ai_monitoring.record_content.enabled = false

  helper.runInTransaction(agent, () => {
    api.addCustomAttribute('llm.conversation_id', conversationId)
    const chatMessageEvent = new LlmChatCompletionMessage({
      agent,
      segment: {},
      transaction: {},
      request: {},
      response: {}
    })
    assert.equal(chatMessageEvent.content, undefined)
    end()
  })
})

// TODO: Make the below tests work

test('should use token_count from tokenCountCallback for prompt message', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const expectedCount = 4
  function cb(model, content) {
    assert.equal(model, req.model)
    assert.equal(content, req.contents)
    return expectedCount
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: req,
        response: res,
        completionId: summaryId,
        message: req.contents,
        index: 0
      })
      assert.equal(chatMessageEvent.token_count, expectedCount)
      end()
    })
  })
})

test('should use token_count from tokenCountCallback for completion messages', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const expectedCount = 4
  function cb(model, content) {
    assert.equal(model, req.model)
    assert.equal(content, res.candidates[0].content.parts[0].text)
    return expectedCount
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: summaryId,
        message: res.candidates[0].content,
        index: 2
      })
      assert.equal(chatMessageEvent.token_count, expectedCount)
      end()
    })
  })
})

test('should not set token_count if not set in usage nor a callback registered', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: summaryId,
        message: res.candidates[0].content,
        index: 2
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})

test('should not set token_count if not set in usage nor a callback registered returns count', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb() {
    // empty cb
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const summaryId = 'chat-summary-id'
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: summaryId,
        message: res.candidates[0].content,
        index: 2
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})
