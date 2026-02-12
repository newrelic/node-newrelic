/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmTool = require('../tool')
const attachAttributes = require('./attach-attributes')

/**
 * Encapsulates a LangChain LlmTool event.
 */
module.exports = class LangChainLlmTool extends LlmTool {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.input Argument(s) input to the tool before it is run (including the argument name and value if available)
   * @param {string} params.output Output data returned after the tool call has completed
   * @param {string} params.toolName Name of the tool being run
   * @param {string} params.aiAgentName Name of the AI agent associated with the tool call
   * @param {string} params.runId ID assigned by the framework to identify the tool call
   * @param {string} params.description Description of the tool used
   * @param {object} [params.metadata] LangChain metadata object
   * @param {string[]|string} [params.tags] LangChain tags, can be an array of strings or a comma-seperated string
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, runId, input, output, toolName, aiAgentName, description, metadata = {}, tags = '', error }) {
    super({ agent, segment, transaction, vendor: 'langchain', runId, input, output, toolName, aiAgentName, error })

    // `metadata.<key>`, `tags`, and `description` do not
    // appear in the AIM spec, but were a requirement for
    // the initial LangChain instrumentation.
    this.description = description
    attachAttributes({ target: this, metadata, tags })
  }
}
