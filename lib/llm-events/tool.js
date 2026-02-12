/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event-base')

/**
 * An event that captures data about a tool call made by an AI agent.
 */
module.exports = class LlmTool extends LlmEvent {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.vendor Lowercase vendor name, e.g. "openai"
   * @param {string} params.input Argument(s) input to the tool before it is run (including the argument name and value if available)
   * @param {string} params.output Output data returned after the tool call has completed
   * @param {string} params.toolName Name of the tool being run
   * @param {string} params.aiAgentName Name of the AI agent associated with the tool call
   * @param {string} params.runId ID assigned by the framework to identify the tool call
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, vendor, runId, input, output, toolName, aiAgentName, error }) {
    super({ agent, segment, transaction, vendor, error })
    // If user defined metadata is not present or available, it can be omitted from the event.
    // All other attributes listed below MUST be captured and added to the event as the AI
    //  Monitoring UX depends on their presence.
    this.name = toolName
    this.agent_name = aiAgentName
    this.run_id = runId

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = input
      this.output = output
    }
  }
}
