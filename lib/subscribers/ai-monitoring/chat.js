/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AiMonitoringSubscriber = require('./base')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

class AiMonitoringChatSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger, packageName, channelName }) {
    super({ agent, logger, packageName, channelName })
  }

  get streamingEnabled() {
    return this.agent.config.ai_monitoring.streaming.enabled === true
  }

  createCompletionMessage({ ctx, completionId, index, message, request, response }) {
    throw new Error('createCompletionMessage must be implemented by your subscriber')
  }

  createCompletionSummary({ ctx, request, response, err, metadata, tags }) {
    throw new Error('createCompletionSummary must be implemented by your subscriber')
  }

  getMessages({ request, response }) {
    throw new Error('getMessages must be implemented by your subscriber')
  }

  /**
   * Function to create both llm completion summary and messages
   *  as well as assign errors to transaction if present
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {object} params.request request made to method on a given llm library
   * @param {object} params.response response from method on a given llm library
   * @param {object} params.err error if present
   * @param {object} params.metadata used only for langchain events at the moment
   * @param {Array} params.tags used only for langchain events at the moment
   */
  recordChatCompletionEvents({ ctx, request, response, err, metadata = {}, tags = [] }) {
    if (!this.enabled) {
      this.logger.debug('config.ai_monitoring.enabled is set to false, not creating chat completion events.')
      return
    }

    if (!(ctx?.segment || ctx?.transaction)) {
      this.logger.debug('Empty context, not creating completion events.')
      return
    }

    // Explicitly end segment to provide consistent duration
    // for both LLM events and the segment
    ctx.segment.end()
    const completionSummary = this.createCompletionSummary({ ctx, request, response, err, metadata, tags })
    const messages = this.getMessages({ request, response })
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const completionMessage = this.createCompletionMessage({ ctx, completionId: completionSummary.id, index: i, message, request, response })
      this.recordEvent({ type: 'LlmChatCompletionMessage', msg: completionMessage })
    }

    this.recordEvent({ type: 'LlmChatCompletionSummary', msg: completionSummary })

    if (err) {
      const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
      this.agent.errors.add(ctx.transaction, err, llmError)
    }
  }
}

module.exports = AiMonitoringChatSubscriber
