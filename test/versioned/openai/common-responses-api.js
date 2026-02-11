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
  { tx, chatMsgs, id, model, reqContent, resContent, singleInput = false },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    request_id: 'req_dfcfcd9f6a176a36c7e386577161b792',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': model,
    vendor: 'openai',
    ingest_source: 'Node',
    role: 'user',
    completion_id: /[a-f0-9]{32}/
  }

  if (!singleInput) {
    chatMsgs.forEach((msg) => {
      const expectedChatMsg = { ...baseMsg }
      if (msg[1].sequence === 0) {
        expectedChatMsg.sequence = 0
        expectedChatMsg.role = 'user'
        expectedChatMsg.id = `${id}-0`
        expectedChatMsg.content = reqContent
        expectedChatMsg.timestamp = /\d{13}/
        expectedChatMsg.token_count = 0
      } else if (msg[1].sequence === 1) {
        expectedChatMsg.sequence = 1
        expectedChatMsg.role = 'user'
        expectedChatMsg.id = `${id}-1`
        expectedChatMsg.content = 'What does 1 plus 1 equal?'
        expectedChatMsg.timestamp = /\d{13}/
        expectedChatMsg.token_count = 0
      } else {
        expectedChatMsg.sequence = 2
        expectedChatMsg.role = 'assistant'
        expectedChatMsg.id = `${id}-2`
        expectedChatMsg.content = resContent
        expectedChatMsg.is_response = true
        expectedChatMsg.token_count = 0
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
        expectedChatMsg.token_count = 0
      } else {
        expectedChatMsg.sequence = 1
        expectedChatMsg.role = 'assistant'
        expectedChatMsg.id = `${id}-1`
        expectedChatMsg.content = resContent
        expectedChatMsg.is_response = true
        expectedChatMsg.token_count = 0
      }

      assert.equal(msg[0].type, 'LlmChatCompletionMessage')
      match(msg[1], expectedChatMsg, { assert })
    })
  }
}

/**
 * Asserts that the OpenAI LlmChatCompletionSummary has the expected properties.
 * @param {object} params1 main params object
 * @param {Transaction} params1.tx associated transaction
 * @param {string} params1.model LLM id
 * @param {LlmChatCompletionSummary} params1.chatSummary The `LlmChatCompletionSummary` to check.
 * @param {boolean} [params1.error] Should `chatSummary.error` equal `true`? Defaults to `false`.
 * @param {boolean} [params1.singleInput] Does this chatSummary have a single input/request message? Defaults to `false`.
 * @param {boolean} [params1.streaming] Was this created via a streaming API? Defaults to `false`.
 * @param {number} [params1.promptTokens] Prompt tokens, defaults to 11.
 * @param {number} [params1.completionTokens] Completion tokens, defaults to 53.
 * @param {number} [params1.totalTokens] Total tokens, defaults to 64.
 * @param {object} [params2] params object to contain assert library
 * @param {object} [params2.assert] assert library to use
 */
function assertChatCompletionSummary(
  { tx, model, chatSummary, error = false, singleInput = false, streaming = false, promptTokens = 11, completionTokens = 53, totalTokens = 64 },
  { assert = require('node:assert') } = {}
) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  let expectedChatSummary
  if (!error) {
    expectedChatSummary = {
      duration: segment.getDurationInMillis(),
      id: /[a-f0-9]{32}/,
      ingest_source: 'Node',
      request_id: 'req_dfcfcd9f6a176a36c7e386577161b792',
      'request.model': model,
      'response.choices.finish_reason': 'completed',
      'response.headers.llmVersion': '2020-10-01',
      'response.model': 'gpt-4-0613',
      'response.number_of_messages': singleInput ? 2 : 3,
      'response.organization': 'new-relic-nkmd8b',
      'response.headers.ratelimitLimitRequests': '10000',
      'response.headers.ratelimitLimitTokens': '1000000',
      'response.headers.ratelimitRemainingRequests': '9999',
      'response.headers.ratelimitRemainingTokens': '999984',
      'response.headers.ratelimitResetTokens': '0s',
      'response.usage.prompt_tokens': promptTokens,
      'response.usage.completion_tokens': completionTokens,
      'response.usage.total_tokens': totalTokens,
      span_id: segment.id,
      trace_id: tx.traceId,
      vendor: 'openai',
      timestamp: /\d{13}/
    }

    // For some reason the responses API streaming does not return rate limit headers
    if (streaming) {
      expectedChatSummary['response.headers.ratelimitLimitRequests'] = undefined
      expectedChatSummary['response.headers.ratelimitLimitTokens'] = undefined
      expectedChatSummary['response.headers.ratelimitRemainingRequests'] = undefined
      expectedChatSummary['response.headers.ratelimitRemainingTokens'] = undefined
      expectedChatSummary['response.headers.ratelimitResetTokens'] = undefined
    }
  } else {
    expectedChatSummary = {
      id: /[a-f0-9]{32}/,
      duration: segment.getDurationInMillis(),
      error: true,
      ingest_source: 'Node',
      'request.model': model,
      'response.number_of_messages': 2,
      span_id: segment.id,
      trace_id: tx.traceId,
      vendor: 'openai',
      timestamp: /\d{13}/
    }
  }

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedChatSummary, { assert })
}
