/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringEmbeddingSubscriber } = require('../ai-monitoring')
const { AI } = require('../../../lib/metrics/names')
const { GEMINI } = AI
const { LlmEmbedding } = require('#agentlib/llm-events/google-genai/index.js')

class GoogleGenAIEmbedContentSubscriber extends AiMonitoringEmbeddingSubscriber {
  constructor ({ agent, logger }) {
    super({ agent, logger, packageName: '@google/genai', channelName: 'nr_embedContent', trackingPrefix: GEMINI.TRACKING_PREFIX, name: GEMINI.EMBEDDING })
    this.events = ['asyncEnd']
  }

  createEmbedding({ ctx, request, response = {}, err }) {
    const { segment, transaction } = ctx
    return new LlmEmbedding({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      withError: !!err
    })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    const { result: response = {}, arguments: args, error: err } = data
    const [request] = args
    this.recordEmbedding({
      ctx,
      request,
      response,
      err
    })
  }
}

module.exports = GoogleGenAIEmbedContentSubscriber
