/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmChatCompletionSummary = require('../../../../lib/llm-events/openai/chat-completion-summary')
const helper = require('../../../lib/agent_helper')
const { req, chatRes, getExpectedResult } = require('./common')

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
        request: req,
        response: chatRes
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
