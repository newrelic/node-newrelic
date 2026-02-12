/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmChatCompletionMessage = require('../chat-completion-message')
const attachAttributes = require('./attach-attributes')

/**
 * Encapsulates a LangChain LlmChatCompletionMessage.
 */
class LangChainLlmChatCompletionMessage extends LlmChatCompletionMessage {
  virtual_llm = true

  /**
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.runId LangChain run ID (will be used as response ID)
   * @param {number} params.sequence Index (beginning at 0) associated with
   *    each message including the prompt and responses
   * @param {string} params.content Content of the message
   * @param {string} [params.role] Role of the message creator (e.g. `user`, `assistant`, `tool`)
   * @param {string} params.completionId ID of the `LlmChatCompletionSummary` event that
   *    this message event is connected to
   * @param {boolean} [params.isResponse] `true` if a message is the result of a chat
   *    completion and not an input message - omitted in `false` cases
   * @param {object} params.metadata LangChain metadata object
   * @param {string[]|string} params.tags LangChain tags, can be an array of strings or a comma-seperated string
   */
  constructor({ agent, segment, transaction, runId, sequence, role, content, completionId, isResponse, metadata = {}, tags = '' }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'langchain',
      responseId: runId,
      requestId: runId,
      sequence,
      content,
      role,
      completionId,
      isResponse })

    attachAttributes({ target: this, agent, metadata, tags })
  }
}

module.exports = LangChainLlmChatCompletionMessage
