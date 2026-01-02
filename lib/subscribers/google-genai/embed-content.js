/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const GoogleGenAISubscriber = require('./base')
const { AI } = require('../../../lib/metrics/names')
const { GEMINI } = AI
const {
  LlmErrorMessage,
  LlmEmbedding
} = require('../../../lib/llm-events/google-genai')

class GoogleGenAIEmbedContentSubscriber extends GoogleGenAISubscriber {
  constructor ({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_embedContent' })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not creating segment.')
      return ctx
    }
    const segment = this.agent.tracer.createSegment({
      name: GEMINI.EMBEDDING,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    const agent = this.agent
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not recording Llm events.')
      return
    }
    const ctx = agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    this.addLlmMeta({ transaction: ctx.transaction, version: data.moduleVersion })
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    const { result: response = {}, arguments: args, error: err } = data
    const [request] = args

    // Explicitly end segment to get consistent duration
    // for both LLM events and the segment
    ctx.segment.end()

    const embedding = new LlmEmbedding({
      agent,
      segment: ctx.segment,
      transaction: ctx.transaction,
      request,
      response,
      withError: err != null
    })

    this.recordEvent({ type: 'LlmEmbedding', msg: embedding })

    if (err) {
      const llmError = new LlmErrorMessage({ cause: err, embedding, response })
      agent.errors.add(ctx.transaction, err, llmError)
    }
  }
}

module.exports = GoogleGenAIEmbedContentSubscriber
