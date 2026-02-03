/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmTool = require('../tool')
const { isSimpleObject } = require('../../util/objects')

/**
 * Encapsulates a LangChain LlmTool event.
 */
class LangChainLlmTool extends LlmTool {
  constructor({ agent, segment, transaction, runId, input, output, toolName, aiAgentName, description, metadata = {}, tags = '', error }) {
    super({ agent, segment, transaction, vendor: 'langchain', runId, input, output, toolName, aiAgentName, error })

    // TODO: Does not appear in AIM spec, but was a
    // requirement for LangChain instrumentation back in 2024?
    this.appName = agent.config.applications()[0]
    this.langchainMeta = metadata
    this.tags = Array.isArray(tags) ? tags.join(',') : tags
    this.description = description
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

module.exports = LangChainLlmTool
