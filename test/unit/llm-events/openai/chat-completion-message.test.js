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
  t.autoend()

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
        const chatMessageEvent = new LlmChatCompletionMessage({
          agent,
          segment,
          request: req,
          response: chatRes,
          index: 0
        })
        const expected = getExpectedResult(
          tx,
          { id: 'res-id-0' },
          'message',
          chatMessageEvent.completion_id
        )
        t.same(chatMessageEvent, expected)
        t.end()
      })
    })
  })

  t.test('should set conversation_id from custom attributes', (t) => {
    const api = helper.getAgentApi()
    const conversationId = 'convo-id'
    helper.runInTransaction(agent, () => {
      api.addCustomAttribute('conversation_id', conversationId)
      const chatMessageEvent = new LlmChatCompletionMessage({
        agent,
        segment: {},
        request: {},
        response: {}
      }).serialize()
      t.equal(chatMessageEvent.conversation_id, conversationId)
      t.end()
    })
  })
})
