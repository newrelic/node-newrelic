/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmChatCompletionSummary = require('../../../../lib/llm-events/openai/chat-completion-summary')
const helper = require('../../../lib/agent_helper')
const { req, chatRes, getExpectedResult } = require('./common')

tap.test('LlmChatCompletionSummary', (t) => {
  t.autoend()

  let agent
  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should properly create a LlmChatCompletionSummary event', (t) => {
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
        t.same(chatSummaryEvent, expected)
        t.end()
      })
    })
  })

  t.test('should set error to true', (t) => {
    helper.runInTransaction(agent, () => {
      const chatSummaryEvent = new LlmChatCompletionSummary({
        agent,
        segment: null,
        request: {},
        response: {},
        withError: true
      })
      t.equal(true, chatSummaryEvent.error)
      t.end()
    })
  })

  t.test('should set `llm.` attributes from custom attributes', (t) => {
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
      t.equal(chatSummaryEvent['llm.conversation_id'], conversationId)
      t.equal(chatSummaryEvent['llm.foo'], 'bar')
      t.equal(chatSummaryEvent['llm.bar'], 'baz')
      t.notOk(chatSummaryEvent['rando-key'])
      t.end()
    })
  })
})
