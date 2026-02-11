/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { AiMonitoringEmbeddingSubscriber } = require('../ai-monitoring')
const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const { LlmEmbedding } = require('#agentlib/llm-events/openai/index.js')
const { wrapPromise } = require('../utils')

class OpenAIEmbeddings extends AiMonitoringEmbeddingSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'openai', channelName: 'nr_embeddingsCreate', trackingPrefix: OPENAI.TRACKING_PREFIX, name: OPENAI.EMBEDDING })
    this.events = ['asyncEnd', 'end']
  }

  end(data) {
    wrapPromise.call(this, data)
  }

  createEmbedding({ ctx, request, response = {}, err = null }) {
    const { transaction, segment } = ctx
    const headers = ctx?.extras?.headers || {}
    return new LlmEmbedding({
      agent: this.agent,
      segment,
      transaction,
      request,
      response: { ...response, headers },
      error: err !== null
    })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const { arguments: args, error: err } = data
    const { result: response } = data
    const [request] = args
    this.recordEmbedding({
      ctx,
      request,
      response,
      err
    })
  }
}

module.exports = OpenAIEmbeddings
