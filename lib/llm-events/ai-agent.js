/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event-base')

/**
 * Encapsulates a LlmAgent event which represents an
 * AI agent invocation.
 */
module.exports = class LlmAgent extends LlmEvent {
  /**
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.aiAgentName Name of the AI agent
   * @param {string} params.vendor Name of the AI agent vendor e.g. 'langgraph'
   * @param {boolean} [params.error] Set to `true` if an error occurred
   */
  constructor({ agent, segment, transaction, aiAgentName, vendor, error }) {
    super({ agent, segment, transaction, vendor, error })
    this.name = aiAgentName ?? 'agent'
  }
}
