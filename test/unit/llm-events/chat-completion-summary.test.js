/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmChatCompletionSummary = require('#agentlib/llm-events/chat-completion-summary.js')
const helper = require('../../lib/agent_helper')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should set all constructor properties when all params are provided', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor',
        responseModel: 'test-model',
        requestModel: 'test-model',
        requestId: 'req-123',
        responseOrg: 'org-abc',
        temperature: 0.7,
        maxTokens: 512,
        numMsgs: 5,
        finishReason: 'stop'
      })

      assert.equal(event.vendor, 'testVendor')
      assert.equal(event['response.model'], 'test-model')
      assert.equal(event['request.model'], 'test-model')
      assert.equal(event.request_id, 'req-123')
      assert.equal(event['response.organization'], 'org-abc')
      assert.equal(event['request.temperature'], 0.7)
      assert.equal(event['request.max_tokens'], 512)
      assert.equal(event['response.number_of_messages'], 5)
      assert.equal(event['response.choices.finish_reason'], 'stop')
      assert.equal(event.timestamp, segment.timer.start)
      assert.equal(event.duration, segment.getDurationInMillis())
      assert.equal(event.ingest_source, 'Node')
      assert.equal(event.trace_id, tx.traceId)
      assert.equal(event.span_id, segment.id)
      assert.ok(event.id)
      end()
    })
  })
})

test('should omit optional properties when not provided', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      assert.equal(event['request.model'], undefined)
      assert.equal(event['request.max_tokens'], undefined)
      assert.equal(event['request.temperature'], undefined)
      assert.equal(event['response.choices.finish_reason'], undefined)
      assert.equal(event['response.organization'], undefined)
      assert.equal(event.request_id, undefined)
      assert.equal(event['response.model'], undefined)
      assert.equal(event.error, undefined)
      assert.equal(event.time_to_first_token, undefined)
      end()
    })
  })
})

test('should default numMsgs to 0', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      assert.equal(event['response.number_of_messages'], 0)
      end()
    })
  })
})

test('should set error to true when error param is true', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor',
        error: true
      })

      assert.equal(event.error, true)
      end()
    })
  })
})

test('should calculate time_to_first_token when timeOfFirstToken is provided', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const timeOfFirstToken = segment.timer.start + 150
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor',
        timeOfFirstToken
      })

      assert.equal(event['time_to_first_token'], 150)
      end()
    })
  })
})

test('should not set time_to_first_token when timeOfFirstToken is not provided', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      assert.equal(event['time_to_first_token'], undefined)
      end()
    })
  })
})

test('setTokensInResponse should set token counts when both prompt and completion tokens are valid', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      event.setTokensInResponse({ promptTokens: 10, completionTokens: 20, totalTokens: 30 })
      assert.equal(event['response.usage.prompt_tokens'], 10)
      assert.equal(event['response.usage.completion_tokens'], 20)
      assert.equal(event['response.usage.total_tokens'], 30)
      end()
    })
  })
})

test('setTokensInResponse should calculate total tokens when totalTokens is not provided', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      event.setTokensInResponse({ promptTokens: 15, completionTokens: 25 })
      assert.equal(event['response.usage.prompt_tokens'], 15)
      assert.equal(event['response.usage.completion_tokens'], 25)
      assert.equal(event['response.usage.total_tokens'], 40)
      end()
    })
  })
})

test('setTokensInResponse should not set tokens when prompt tokens are invalid', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      event.setTokensInResponse({ promptTokens: null, completionTokens: 20, totalTokens: 30 })
      assert.equal(event['response.usage.prompt_tokens'], undefined)
      assert.equal(event['response.usage.completion_tokens'], undefined)
      assert.equal(event['response.usage.total_tokens'], undefined)
      end()
    })
  })
})

test('setTokenUsageFromCallback should set tokens using the callback function', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      const tokenCB = (model, content) => {
        if (content === 'prompt') return 12
        return 18
      }

      event.setTokenUsageFromCallback({
        tokenCB,
        reqModel: 'test-model',
        resModel: 'test-model',
        promptContent: 'prompt',
        completionContent: 'completion'
      })

      assert.equal(event['response.usage.prompt_tokens'], 12)
      assert.equal(event['response.usage.completion_tokens'], 18)
      assert.equal(event['response.usage.total_tokens'], 30)
      end()
    })
  })
})

test('totalTokenCount getter should sum prompt and completion tokens', (t, end) => {
  const { agent } = t.nr
  const api = helper.getAgentApi()
  helper.runInTransaction(agent, (tx) => {
    api.startSegment('fakeSegment', false, () => {
      const segment = api.shim.getActiveSegment()
      segment.end()
      const event = new LlmChatCompletionSummary({
        agent,
        segment,
        transaction: tx,
        vendor: 'testVendor'
      })

      event.setTokensInResponse({ promptTokens: 7, completionTokens: 13, totalTokens: 20 })
      assert.equal(event.totalTokenCount, 20)
      end()
    })
  })
})
