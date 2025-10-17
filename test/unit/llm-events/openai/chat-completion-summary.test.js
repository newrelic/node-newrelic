/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmChatCompletionSummary = require('../../../../lib/llm-events/openai/chat-completion-summary')
const helper = require('../../../lib/agent_helper')
const ChatCompletions = require('./common-chat-api')
const Responses = require('./common-responses-api')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  Responses.chatRes.usage.prompt_tokens = 10
  helper.unloadAgent(ctx.nr.agent)
})

test('chat.completions.create should properly create a LlmChatCompletionSummary event', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: ChatCompletions.req,
        response: ChatCompletions.chatRes
      })
      const expected = ChatCompletions.getExpectedResult(tx, chatSummaryEvent, 'summary')
      assert.deepEqual(chatSummaryEvent, expected)
      end()
    })
  })
})

test('responses.create should properly create a LlmChatCompletionSummary event', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: Responses.req,
        response: Responses.chatRes
      })
      const expected = Responses.getExpectedResult(tx, chatSummaryEvent, 'summary')
      assert.deepEqual(chatSummaryEvent, expected)
      end()
    })
  })
})

test('should set error to true', (ctx, end) => {
  const { agent } = ctx.nr
  helper.runInTransaction(agent, () => {
    const chatSummaryEvent = new LlmChatCompletionSummary({
      agent,
      transaction: null,
      segment: null,
      request: {},
      response: {},
      withError: true
    })
    assert.equal(true, chatSummaryEvent.error)
    end()
  })
})

test('should set `llm.` attributes from custom attributes', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const conversationId = 'convo-id'
  helper.runInTransaction(agent, () => {
    api.addCustomAttribute('llm.conversation_id', conversationId)
    api.addCustomAttribute('llm.foo', 'bar')
    api.addCustomAttribute('llm.bar', 'baz')
    api.addCustomAttribute('rando-key', 'rando-value')
    const chatSummaryEvent = new LlmChatCompletionSummary({
      agent,
      segment: null,
      transaction: null,
      request: {},
      response: {}
    })
    assert.equal(chatSummaryEvent['llm.conversation_id'], conversationId)
    assert.equal(chatSummaryEvent['llm.foo'], 'bar')
    assert.equal(chatSummaryEvent['llm.bar'], 'baz')
    assert.ok(!chatSummaryEvent['rando-key'])
    end()
  })
})

test('does not capture any token usage attributes when response is missing prompt or completion tokens', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    delete Responses.chatRes.usage.prompt_tokens
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: Responses.req,
        response: Responses.chatRes
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], undefined)
      end()
    })
  })
})

test('should capture any token usage attributes when response is missing total tokens and calculates it instead', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    delete Responses.chatRes.usage.total_tokens
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: Responses.req,
        response: Responses.chatRes
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], 10)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], 20)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], 30)
      end()
    })
  })
})

test('should use token callback to set the token usage attributes', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb(model, content) {
    if (content === Responses.req.input) {
      return 30
    } else {
      return 35
    }
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: Responses.req,
        response: Responses.chatRes
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], 30)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], 35)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], 65)
      end()
    })
  })
})
