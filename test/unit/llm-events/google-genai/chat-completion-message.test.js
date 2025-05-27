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
