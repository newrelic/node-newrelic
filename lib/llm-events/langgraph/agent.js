/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmEvent = require('../base')

/**
 * Encapsulates a `@langchain/langgraph` LlmAgent event.
 */
module.exports = class LangGraphLlmAgent extends LlmEvent {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.aiAgentName Name of the AI agent which can typically be captured through framework context
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, aiAgentName, error }) {
    super({ agent, segment, transaction, vendor: 'langgraph', error })
    this.name = aiAgentName ?? 'agent'
  }
}
