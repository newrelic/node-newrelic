/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmChatCompletionSummary = require('../chat-completion-summary')
const { isSimpleObject } = require('../../util/objects')

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

    // Does not appear in AIM spec as of 2/2026, but seemed
    // to be a requirement back in 1/2024 (e.g. LangChain CDD).
    this.appName = agent.config.applications()[0]

    // `metadata.<key>` and `tags` do not appear in
    // the AIM spec, but were a requirement for the
    // initial LangChain instrumentation.
    if (isSimpleObject(metadata)) {
      this.langchainMeta = metadata
      for (const [key, val] of Object.entries(metadata)) {
        this[`metadata.${key}`] = val
      }
    }
    this.tags = Array.isArray(tags) ? tags.join(',') : tags
  }
}

module.exports = LangChainLlmChatCompletionSummary
