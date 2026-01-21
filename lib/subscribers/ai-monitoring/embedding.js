/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AiMonitoringSubscriber = require('./base')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

class AiMonitoringEmbeddingSubscriber extends AiMonitoringSubscriber {
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

  /**
   * Function that must be implemented by inherited subscriber to create an llm embedding.
   *
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {object} params.request request made to method on a given llm library
   * @param {object} params.response response from method on a given llm library
   * @param {object} params.err error if present
   * returns {object} a llm embedding instance for the given LLM
   */
  createEmbedding({ ctx, request, response, err }) {
    throw new Error('createEmbedding must be implemented by your subscriber')
  }

  /**
   * Function to create embedding as well as assign errors to transaction if present
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {object} params.request request made to method on a given llm library
   * @param {object} params.response response from method on a given llm library
   * @param {object} params.err error if present
   */
  recordEmbedding({ ctx, request, response, err }) {
    if (!this.enabled) {
      this.logger.debug('config.ai_monitoring.enabled is set to false, not creating embedding event.')
      return
    }

    if (!(ctx?.segment || ctx?.transaction)) {
      this.logger.debug('Empty context, not creating embedding event.')
      return
    }

    // Explicitly end segment to provide consistent duration
    // for both LLM events and the segment
    ctx.segment.end()
    const embedding = this.createEmbedding({ ctx, request, response, err })
    this.recordEvent({ type: 'LlmEmbedding', msg: embedding })

    if (err) {
      const llmError = new LlmErrorMessage({ cause: err, embedding, response })
      this.agent.errors.add(ctx.transaction, err, llmError)
    }
  }
}

module.exports = AiMonitoringEmbeddingSubscriber
