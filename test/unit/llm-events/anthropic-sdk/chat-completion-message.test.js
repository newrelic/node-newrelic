/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { LlmChatCompletionMessage } = require('#agentlib/llm-events/anthropic-sdk/index.js')
const helper = require('#testlib/agent_helper.js')
const { req, res, getExpectedResult } = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  res.usage = { input_tokens: 53, output_tokens: 11 }
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
        content: req.messages[0].content,
        role: 'user',
        sequence: 0
      })
      const expected = getExpectedResult(tx, chatMessageEvent, 'message', summaryId)
      expected.timestamp = segment.timer.start
      assert.deepEqual(chatMessageEvent, expected)
      end()
    })
  })
})

test('should create a LlmChatCompletionMessage from response', (t, end) => {
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
        content: res.content[0].text,
        sequence: 1,
        isResponse: true
      })
      const expected = getExpectedResult(tx, chatMessageEvent, 'message', summaryId)
      expected.sequence = 1
      expected.content = '1 plus 2 is 3.'
      expected.role = 'assistant'
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
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      api.addCustomAttribute('llm.conversation_id', conversationId)
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: {},
        response: {}
      })
      assert.equal(chatMessageEvent['llm.conversation_id'], conversationId)
      end()
    })
  })
})

test('content will not be recorded if record_content is not enabled', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  agent.config.ai_monitoring.record_content.enabled = false
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        content: 'should not appear',
        role: 'user'
      })
      assert.equal(chatMessageEvent.content, undefined)
      end()
    })
  })
})

test('should capture token_count even when record_content is false', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  agent.config.ai_monitoring.record_content.enabled = false
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: req,
        response: res,
        completionId: 'summary-id',
        content: req.messages[0].content,
        role: 'user',
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, 0)
      end()
    })
  })
})

test('should use token_count from tokenCountCallback', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb(model, content) {
    assert.equal(model, req.model)
    return 4
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        transaction: tx,
        agent,
        segment,
        request: req,
        response: res,
        completionId: 'summary-id',
        content: req.messages[0].content,
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, 0)
      end()
    })
  })
})

test('should not set token_count if no usage and no callback registered', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: { model: 'claude-sonnet-4-20250514' },
        completionId: 'summary-id',
        content: req.messages[0].content,
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})

test('should not set token_count if callback returns undefined', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb() {
    // no-op
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: 'summary-id',
        content: req.messages[0].content,
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})

test('should not set token_count if callback returns negative', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb() {
    return -1
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: 'summary-id',
        content: req.messages[0].content,
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})

test('should not set token_count if callback returns null', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb() {
    return null
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        completionId: 'summary-id',
        content: req.messages[0].content,
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})

test('should handle content blocks in request messages', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const blockReq = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }] }
    ]
  }
  function cb(model, content) {
    return 10
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: blockReq,
        response: res,
        completionId: 'summary-id',
        content: 'Hello world',
        role: 'user',
        sequence: 0
      })
      assert.equal(chatMessageEvent.token_count, 0)
      end()
    })
  })
})

test('should return empty string for msg.content that is neither string nor array', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  let cbCalled = false
  function cb() {
    cbCalled = true
    return 10
  }
  api.setLlmTokenCountCallback(cb)
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      delete res.usage
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment,
        transaction: tx,
        request: {
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: { type: 'unsupported' } }]
        },
        response: res,
        completionId: 'summary-id',
        content: 'test',
        role: 'user',
        sequence: 0
      })
      // msg.content is an object (not string, not array) so promptContent = ''
      // which causes the `if (promptContent && completionContent)` check to fail
      assert.equal(cbCalled, false, 'should not invoke callback when promptContent is empty')
      assert.equal(chatMessageEvent.token_count, undefined)
      end()
    })
  })
})
