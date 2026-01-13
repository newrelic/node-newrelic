/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const { AI: { LANGCHAIN } } = require('../../metrics/names')

class LangchainRunnableSubscriber extends LangchainSubscriber {
  constructor ({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_invoke' })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('Langchain instrumentation is disabled, not creating segment.')
      return ctx
    }
    const llmChatInputTime = Date.now()

    const segment = this.agent.tracer.createSegment({
      name: `${LANGCHAIN.CHAIN}/invoke`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    const newCtx = ctx.enterSegment({ segment })
    newCtx._extras.llmChatInputTime = llmChatInputTime
    return newCtx
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('Langchain instrumentation is disabled via `config.ai_monitoring.enabled`, not recording Llm events.')
      return
    }
    const ctx = this.agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { result, error: err, moduleVersion: pkgVersion } = data

    this.recordChatCompletionEvents({
      pkgVersion,
      transaction,
      segment,
      messages: [result],
      events: [request, result],
      metadata: params?.metadata ?? {},
      tags: params?.tags ?? [],
      err,
      inputTimestamp: ctx?._extras?.llmChatInputTime
    })
  }
}

module.exports = LangchainRunnableSubscriber
