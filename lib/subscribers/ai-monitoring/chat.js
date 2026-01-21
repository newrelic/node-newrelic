/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AiMonitoringSubscriber = require('./base')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

class AiMonitoringChatSubscriber extends AiMonitoringSubscriber {
  /**
   * @param {object} params constructor params object
   * @param {object} params.agent A New Relic Node.js agent instance.
   * @param {object} params.logger An agent logger instance.
   * @param {string} params.packageName The package name being instrumented.
   * This is what a developer would provide to the `require` function.
   * @param {string} params.channelName A unique name for the diagnostics channel
   * that will be created and monitored.
   * @param {string} params.name name of segment for a given subscriber
   * @param {string} params.trackingPrefix prefix for the tracking metric for a given subscriber
   */
  constructor({ agent, logger, packageName, channelName, name, trackingPrefix }) {
    super({ agent, logger, packageName, channelName, name, trackingPrefix })
  }

  get streamingEnabled() {
    return this.agent.config.ai_monitoring.streaming.enabled === true
  }

  /**
   * Function that must be implemented by inherited subscriber to create an llm completion message.
   *
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {object} params.request request made to method on a given llm library
   * @param {object} params.response response from method on a given llm library
   * @param {object|string} params.message the message object/string used to create llm completion message
   * @param {string} params.completionId the id of the llm completion summary for a given conversation
   * @param {number} params.index index of message for a given conversation
   * returns {object} a llm completion message instance for the given LLM
   */
  createCompletionMessage({ ctx, request, response, message, completionId, index }) {
    throw new Error('createCompletionMessage must be implemented by your subscriber')
  }

  /**
   * Function that must be implemented by inherited subscriber to create the llm completion summary.
   *
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {object} params.request request made to method on a given llm library
   * @param {object} params.response response from method on a given llm library
   * @param {object} params.err error if present
   * @param {object} params.metadata used only for langchain events at the moment
   * @param {Array} params.tags used only for langchain events at the moment
   * returns {object} a llm completion summary instance for the given LLM
   */
  createCompletionSummary({ ctx, request, response, err, metadata, tags }) {
    throw new Error('createCompletionSummary must be implemented by your subscriber')
  }

  /**
   * Function that must be implemented by inherited subscriber to retrieve the relevant
   * messages for a given chat conversation.
   *
   * @param {object} params to function
   * @param {object} params.request request to instrumented function
   * @param {object} params.response response to instrumented function
   * returns {Array} an array of relevant messages used to construct llm completion messages
   */
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
    this.recordEvent({ type: 'LlmChatCompletionSummary', msg: completionSummary })

    const messages = this.getMessages({ request, response })
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const completionMessage = this.createCompletionMessage({ ctx, completionId: completionSummary.id, index: i, message, request, response })
      this.recordEvent({ type: 'LlmChatCompletionMessage', msg: completionMessage })
    }

    if (err) {
      const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
      this.agent.errors.add(ctx.transaction, err, llmError)
    }
  }
}

module.exports = AiMonitoringChatSubscriber
