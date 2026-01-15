/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const AiMonitoringSubscriber = require('./base')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

class AiMonitoringEmbeddingSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger, packageName, channelName }) {
    super({ agent, logger, packageName, channelName })
  }

  createEmbedding({ ctx, request, response, err }) {
    throw new Error('createEmbedding must be implemented by your subscriber')
  }

  /**
   * Function to create embedding
   *  as well as assign errors to transaction if present
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
