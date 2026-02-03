/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmChatCompletionSummary = require('../chat-summary')
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

    // TODO: Does not appear in AIM spec, but was a
    // requirement for LangChain instrumentation back in 2024?
    this.appName = agent.config.applications()[0]
    this.langchainMeta = metadata
    this.tags = Array.isArray(tags) ? tags.join(',') : tags
  }

  // eslint-disable-next-line accessor-pairs
  set langchainMeta(value) {
    if (isSimpleObject(value) === false) {
      return
    }
    for (const [key, val] of Object.entries(value)) {
      this[`metadata.${key}`] = val
    }
  }
}

module.exports = LangChainLlmChatCompletionSummary
