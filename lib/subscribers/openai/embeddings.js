/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const OpenAISubscriber = require('./base')
const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const {
  addLlmMeta,
  recordEmbeddingMessage
} = require('./utils')

class OpenAIEmbeddings extends OpenAISubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_embeddingsCreate' })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('OpenAI instrumentation is disabled, not creating segment.')
      return
    }
    return this.createSegment({
      name: OPENAI.EMBEDDING,
      ctx
    })
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('OpenAI instrumentation is disabled, not recording Llm events.')
      return
    }
    const ctx = this.agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { arguments: args, error: err } = data
    const { result: response } = data
    const [request] = args
    const agent = this.agent
    const { segment, transaction } = ctx
    recordEmbeddingMessage({
      agent,
      logger: this.logger,
      segment,
      transaction,
      request,
      response,
      headers: ctx.extras?.headers,
      err
    })
    addLlmMeta({ agent, transaction, version: data.moduleVersion })
  }
}

module.exports = OpenAIEmbeddings
