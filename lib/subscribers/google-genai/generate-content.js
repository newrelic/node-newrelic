/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const GoogleGenAISubscriber = require('./base')
const { AI } = require('../../metrics/names')
const { GEMINI } = AI

class GoogleGenAIGenerateContentSubscriber extends GoogleGenAISubscriber {
  constructor({ agent, logger, channelName = 'nr_generateContentInternal' }) {
    super({ agent, logger, channelName })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not creating segment.')
      return ctx
    }
    const segment = this.agent.tracer.createSegment({
      name: GEMINI.COMPLETION,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not recording Llm events.')
      return
    }
    const ctx = this.agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { result: response, arguments: args, error: err } = data
    const [request] = args

    this.recordChatCompletionMessages({
      segment: ctx.segment,
      transaction: ctx.transaction,
      request,
      response,
      err
    })

    this.addLlmMeta({
      transaction: ctx.transaction,
      version: data.moduleVersion
    })
  }
}

module.exports = GoogleGenAIGenerateContentSubscriber
