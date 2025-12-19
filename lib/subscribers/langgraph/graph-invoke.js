/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangGraphSubscriber = require('./base')
const { AI: { LANGGRAPH } } = require('#agentlib/metrics/names.js')

/**
 * Subscribes to `Pregel.invoke()` events. Only exists for
 * a more accurate segment name. Its sibling `LangGraphStreamSubscriber`
 * handles the creation of Llm events because `invoke` is just a
 * wrapper around `stream`, and we don't want to create duplicates.
 */
class LangGraphInvokeSubscriber extends LangGraphSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_invoke' })
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('LangGraph instrumentation is disabled, not creating segment.')
      return ctx
    }

    const agentName = data?.self?.name ?? 'agent'

    const segment = this.agent.tracer.createSegment({
      name: `${LANGGRAPH.AGENT}/invoke/${agentName}`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }
}

module.exports = LangGraphInvokeSubscriber
