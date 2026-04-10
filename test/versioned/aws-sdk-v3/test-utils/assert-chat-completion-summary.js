/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = assertChatCompletionSummary

const assert = require('node:assert')
const { match } = require('../../../lib/custom-assertions')

/**
 * Verifies that an AI chat completion summary message matches the expected
 * shape and data.
 *
 * @param {object} params Function parameters.
 * @param {Transaction} params.tx Transaction containing the chat completion
 * message data.
 * @param {string} params.modelId Name of the LLM used to generate the
 * message data.
 * @param {LlmChatCompletionSummary[]} params.chatSummary Array of LLM
 * chat summary objects to verify.
 * @param {boolean} [params.error] Indicates if the message is an error
 * message.
 * @param {number} [params.numMsgs] The number of expected messages in the
 * summary.
 * @param {number} [params.promptTokens] The number of tokens in the prompt
 * to the LLM.
 * @param {number} [params.completionTokens] The number of tokens the LLM
 * used to generate the messages.
 * @param {number} [params.totalTokens] The total number of tokens used
 * while communicating with the LLM.
 *
 * @throws {Error} When the summary object is invalid.
 */
function assertChatCompletionSummary({
  tx,
  modelId,
  chatSummary,
  error,
  numMsgs = 2,
  promptTokens = 14,
  completionTokens = 9,
  totalTokens = 23
}) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const expectedChatSummary = {
    id: /[a-f0-9]{32}/,
    request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    'llm.conversation_id': 'convo-id',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': modelId,
    vendor: 'bedrock',
    ingest_source: 'Node',
    'request.model': modelId,
    duration: segment.getDurationInMillis(),
    'response.number_of_messages': error ? 1 : numMsgs,
    'request.temperature': 0.5,
    'request.max_tokens': 100,
    timestamp: segment.timer.start
  }

  if (!error) {
    expectedChatSummary['response.usage.prompt_tokens'] = promptTokens
    expectedChatSummary['response.usage.completion_tokens'] = completionTokens
    expectedChatSummary['response.usage.total_tokens'] = totalTokens
    expectedChatSummary['response.choices.finish_reason'] = 'endoftext'
  }
  if (error) expectedChatSummary.error = true

  assert.equal(chatSummary[0].type, 'LlmChatCompletionSummary')
  match(chatSummary[1], expectedChatSummary)
}
