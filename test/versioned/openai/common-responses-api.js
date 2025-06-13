/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  assertChatCompletionMessages,
  assertChatCompletionSummary
}

const { match } = require('../../lib/custom-assertions')

function assertChatCompletionMessages(
  { tx, chatMsgs, id, model, reqContent, resContent, tokenUsage, singleInput = false },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    appName: 'New Relic for Node.js tests',
    request_id: 'req_dfcfcd9f6a176a36c7e386577161b792',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': model,
    vendor: 'openai',
    ingest_source: 'Node',
    role: 'user',
    is_response: false,
    completion_id: /[a-f0-9]{36}/
  }

  if (!singleInput) {
    chatMsgs.forEach((msg) => {
      const expectedChatMsg = { ...baseMsg }
      if (msg[1].sequence === 0) {
        expectedChatMsg.sequence = 0
        expectedChatMsg.id = `${id}-0`
        expectedChatMsg.content = reqContent
        if (tokenUsage) {
          expectedChatMsg.token_count = 53
        }
      } else if (msg[1].sequence === 1) {
        expectedChatMsg.sequence = 1
        expectedChatMsg.id = `${id}-1`
        expectedChatMsg.content = 'What does 1 plus 1 equal?'
        if (tokenUsage) {
          expectedChatMsg.token_count = 53
        }
      } else {
        expectedChatMsg.sequence = 2
        expectedChatMsg.role = 'assistant'
        expectedChatMsg.id = `${id}-2`
        expectedChatMsg.content = resContent
        expectedChatMsg.is_response = true
        if (tokenUsage) {
          expectedChatMsg.token_count = 11
        }
      }

      assert.equal(msg[0].type, 'LlmChatCompletionMessage')
      match(msg[1], expectedChatMsg, { assert })
    })
  } else {
    chatMsgs.forEach((msg) => {
      const expectedChatMsg = { ...baseMsg }
      if (msg[1].sequence === 0) {
        expectedChatMsg.sequence = 0
        expectedChatMsg.id = `${id}-0`
        expectedChatMsg.content = reqContent
        if (tokenUsage) {
          expectedChatMsg.token_count = 53
        }
      } else {
        expectedChatMsg.sequence = 1
        expectedChatMsg.role = 'assistant'
        expectedChatMsg.id = `${id}-1`
        expectedChatMsg.content = resContent
        expectedChatMsg.is_response = true
        if (tokenUsage) {
          expectedChatMsg.token_count = 11
        }
      }

      assert.equal(msg[0].type, 'LlmChatCompletionMessage')
      match(msg[1], expectedChatMsg, { assert })
    })
  }
}

function assertChatCompletionSummary(
  { tx, model, chatSummary, error = false, singleInput = false },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  let expectedChatSummary
  if (!error) {
    expectedChatSummary = {
      appName: 'New Relic for Node.js tests',
      duration: segment.getDurationInMillis(),
      error,
      id: /[a-f0-9]{36}/,
      ingest_source: 'Node',
      request_id: 'req_dfcfcd9f6a176a36c7e386577161b792',
      'request.max_tokens': undefined,
      'request.model': model,
      'request.temperature': undefined,
      'response.choices.finish_reason': 'completed',
      'response.headers.llmVersion': '2020-10-01',
      'response.headers.ratelimitLimitRequests': '10000',
      'response.headers.ratelimitLimitTokens': '1000000',
      'response.headers.ratelimitRemainingRequests': '9999',
      'response.headers.ratelimitRemainingTokens': '999984',
      'response.headers.ratelimitResetTokens': '0s',
      'response.model': 'gpt-4-0613',
      'response.number_of_messages': singleInput ? 2 : 3,
      'response.organization': 'new-relic-nkmd8b',
      span_id: segment.id,
      trace_id: tx.traceId,
      vendor: 'openai'
    }
  } else {
    expectedChatSummary = {
      appName: 'New Relic for Node.js tests',
      id: /[a-f0-9]{36}/,
      duration: segment.getDurationInMillis(),
      error,
      ingest_source: 'Node',
      'request.model': model,
      'response.number_of_messages': 2,
      span_id: segment.id,
      trace_id: tx.traceId,
      vendor: 'openai',
    }
  }

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedChatSummary, { assert })
}
