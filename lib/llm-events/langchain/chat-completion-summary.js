/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionSummary = require('../chat-completion-summary')
const attachAttributes = require('./attach-attributes')

/**
 * Encapsulates a LangChain LlmChatCompletionSummary.
 */
class LangChainLlmChatCompletionSummary extends LlmChatCompletionSummary {
  virtual_llm = true

  constructor({ agent, segment, transaction, error, numMsgs = 0, runId, metadata = {}, tags = '' }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'langchain',
      requestId: runId,
      error,
      numMsgs })

    attachAttributes({ target: this, agent, metadata, tags })
  }
}

module.exports = LangChainLlmChatCompletionSummary
