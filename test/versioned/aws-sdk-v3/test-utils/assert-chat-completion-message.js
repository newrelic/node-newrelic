/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = assertChatCompletionMessage

const assert = require('node:assert')
const { match } = require('../../../lib/custom-assertions')

/**
 * Verifies that an AI chat completion message matches the expected shape
 * and data.
 *
 * @param {object} params Function parameters.
 * @param {Transaction} params.tx Transaction containing the chat completion
 * message data.
 * @param {object} params.message Chat completion message to verify is correct.
 * @param {string} [params.expectedId] When known ahead of time, the identifier
 * for the message. Otherwise, the `message.messageData.id` will be used.
 * @param {string} params.modelId Name of the LLM used to generate the
 * message data.
 * @param {string} params.expectedContent The content that should be present
 * under `message.messageData.content`.
 * @param {boolean} [params.isResponse] Indicates if the chat message is an
 * outgoing or received message.
 * @param {string} params.expectedRole The role name that should be present
 * under `message.messageData.role`.
 * @param {boolean} [params.error] Indicates if the message is an error
 * message.
 *
 * @throws {Error} When the message cannot be validated.
 */
function assertChatCompletionMessage({
  tx,
  message,
  expectedId,
  modelId,
  expectedContent,
  isResponse,
  expectedRole,
  error
}) {
  const [segment] = tx.trace.getChildren(tx.trace.root.id)
  const baseMsg = {
    request_id: 'eda0760a-c3f0-4fc1-9a1e-75559d642866',
    trace_id: tx.traceId,
    span_id: segment.id,
    'response.model': modelId,
    vendor: 'bedrock',
    ingest_source: 'Node',
    role: 'user',
    completion_id: /\w{32}/,
    'llm.conversation_id': 'convo-id'
  }

  if (!error) {
    baseMsg.token_count = 0
  }

  const [messageBase, messageData] = message

  const expectedChatMsg = { ...baseMsg }
  const id = expectedId ? `${expectedId}-${messageData.sequence}` : messageData.id

  expectedChatMsg.sequence = messageData.sequence
  expectedChatMsg.role = expectedRole
  expectedChatMsg.id = id
  expectedChatMsg.content = expectedContent
  if (isResponse) expectedChatMsg.is_response = isResponse
  if (isResponse !== true) {
    expectedChatMsg.timestamp = segment.timer.start
  }

  assert.equal(messageBase.type, 'LlmChatCompletionMessage')
  match(messageData, expectedChatMsg)
}
