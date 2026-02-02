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
  { tx, chatMsgs, id, model, reqContent, resContent, noTokenUsage },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    request_id: '49dbbffbd3c3f4612aa48def69059aad',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': model,
    vendor: 'openai',
    ingest_source: 'Node',
    role: 'user',
    completion_id: /[a-f0-9]{36}/
  }

  chatMsgs.forEach((msg) => {
    const expectedChatMsg = { ...baseMsg }
    if (msg[1].sequence === 0) {
      expectedChatMsg.sequence = 0
      expectedChatMsg.role = 'user'
      expectedChatMsg.id = `${id}-0`
      expectedChatMsg.content = reqContent
      expectedChatMsg.timestamp = /\d{13}/
      if (!noTokenUsage) {
        expectedChatMsg.token_count = 0
      }
    } else if (msg[1].sequence === 1) {
      expectedChatMsg.sequence = 1
      expectedChatMsg.role = 'user'
      expectedChatMsg.id = `${id}-1`
      expectedChatMsg.content = 'What does 1 plus 1 equal?'
      expectedChatMsg.timestamp = /\d{13}/
      if (!noTokenUsage) {
        expectedChatMsg.token_count = 0
      }
    } else {
      expectedChatMsg.sequence = 2
      expectedChatMsg.role = 'assistant'
      expectedChatMsg.id = `${id}-2`
      expectedChatMsg.content = resContent
      expectedChatMsg.is_response = true
      if (!noTokenUsage) {
        expectedChatMsg.token_count = 0
      }
    }

    assert.equal(msg[0].type, 'LlmChatCompletionMessage')
    match(msg[1], expectedChatMsg, { assert })
  })
}

function assertChatCompletionSummary(
  { tx, model, chatSummary, error, promptTokens = 53, completionTokens = 11, totalTokens = 64, noUsageTokens = false },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const expectedChatSummary = {
    id: /[a-f0-9]{36}/,
    request_id: '49dbbffbd3c3f4612aa48def69059aad',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': model,
    vendor: 'openai',
    ingest_source: 'Node',
    'request.model': model,
    duration: segment.getDurationInMillis(),
    'response.organization': 'new-relic-nkmd8b',
    'response.headers.llmVersion': '2020-10-01',
    'response.headers.ratelimitLimitRequests': '200',
    'response.headers.ratelimitLimitTokens': '40000',
    'response.headers.ratelimitResetTokens': '90ms',
    'response.headers.ratelimitRemainingTokens': '39940',
    'response.headers.ratelimitRemainingRequests': '199',
    'response.number_of_messages': 3,
    'response.choices.finish_reason': 'stop',
    timestamp: /\d{13}/
  }
  if (error) expectedChatSummary.error = true

  if (!(error || noUsageTokens)) {
    expectedChatSummary['response.usage.prompt_tokens'] = promptTokens
    expectedChatSummary['response.usage.completion_tokens'] = completionTokens
    expectedChatSummary['response.usage.total_tokens'] = totalTokens
  }

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedChatSummary, { assert })
}
