/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmChatCompletionSummary = require('#agentlib/llm-events/google-genai/chat-completion-summary.js')
const helper = require('#testlib/agent_helper.js')
const { req, res, getExpectedResult } = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
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
