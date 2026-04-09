/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { LlmChatCompletionSummary } = require('#agentlib/llm-events/anthropic-sdk/index.js')
const helper = require('#testlib/agent_helper.js')
const { req, res, getExpectedResult } = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  res.usage = { input_tokens: 53, output_tokens: 11 }
  helper.unloadAgent(ctx.nr.agent)
})

test('should properly create a LlmChatCompletionSummary event', (t, end) => {
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
        request: req,
        response: res
      })
      const expected = getExpectedResult(tx, chatSummaryEvent, 'summary')
      expected.timestamp = segment.timer.start
      assert.deepEqual(chatSummaryEvent, expected)
      end()
    })
  })
})

test('should set error to true', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        transaction: tx,
        segment,
        request: {},
        response: {},
        error: true
      })
      assert.equal(chatSummaryEvent.error, true)
      end()
    })
  })
})

test('should set `llm.` attributes from custom attributes', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const conversationId = 'convo-id'
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      api.addCustomAttribute('llm.conversation_id', conversationId)
      api.addCustomAttribute('llm.foo', 'bar')
      api.addCustomAttribute('llm.bar', 'baz')
      api.addCustomAttribute('rando-key', 'rando-value')
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
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
})

test('should set response.number_of_messages from request messages and response content', (t, end) => {
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
        request: { messages: [{ role: 'user', content: 'hi' }, { role: 'user', content: 'there' }] },
        response: res
      })
      // 2 request messages + 1 response message
      assert.equal(chatSummaryEvent['response.number_of_messages'], 3)
      end()
    })
  })
})

test('should set response.number_of_messages to 0 when no messages or content', (t, end) => {
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
        request: {},
        response: {}
      })
      assert.equal(chatSummaryEvent['response.number_of_messages'], 0)
      end()
    })
  })
})

test('does not capture any token usage attributes when response is missing usage', (t, end) => {
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
        request: req,
        response: { model: 'claude-sonnet-4-20250514' }
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], undefined)
      end()
    })
  })
})

test('does not capture token usage when input_tokens is missing', (t, end) => {
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
        request: req,
        response: { usage: { output_tokens: 11 } }
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], undefined)
      end()
    })
  })
})

test('should use token callback to set the token usage attributes', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb(model, content) {
    if (content === 'What does 1 plus 2 equal?') {
      return 30
    }
    return 35
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
        request: req,
        response: res
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], 30)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], 35)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], 65)
      end()
    })
  })
})

test('should use token callback with content block messages', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  const blockReq = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'text', text: ' world' }
        ]
      }
    ]
  }
  function cb(model, content) {
    // Content blocks are joined with ' ' separator
    if (content === 'Hello  world') {
      return 20
    }
    return 30
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
        request: blockReq,
        response: res
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], 20)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], 30)
      assert.equal(chatSummaryEvent['response.usage.total_tokens'], 50)
      end()
    })
  })
})

test('should not set tokens when callback present but no promptContent', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  function cb() {
    return 10
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
        request: {},
        response: {}
      })
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], undefined)
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
      segment.end()
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: {
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: { type: 'unsupported' } }]
        },
        response: res
      })
      // msg.content is an object (not string, not array) so promptContent = ''
      // which causes the `if (promptContent && completionContent)` check to fail
      assert.equal(cbCalled, false, 'should not invoke callback when promptContent is empty')
      assert.equal(chatSummaryEvent['response.usage.prompt_tokens'], undefined)
      assert.equal(chatSummaryEvent['response.usage.completion_tokens'], undefined)
      end()
    })
  })
})

test('should set time_to_first_token for streaming', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const timeOfFirstToken = segment.timer.start + 150
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        request: req,
        response: res,
        timeOfFirstToken
      })
      assert.equal(chatSummaryEvent['time_to_first_token'], 150)
      end()
    })
  })
})

test('should not set time_to_first_token when not provided', (t, end) => {
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
        request: req,
        response: res
      })
      assert.equal(chatSummaryEvent['time_to_first_token'], undefined)
      end()
    })
  })
})
