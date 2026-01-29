/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const { AI: { LANGGRAPH } } = require('#agentlib/metrics/names.js')

/**
 * Subscribes to `Pregel.invoke()` events. Only exists to
 * create a segment/span. The related `LangGraphStreamSubscriber`
 * handles the creation of Llm events because `invoke` is just a
 * wrapper around `stream`, and we don't want to create duplicates.
 */
class LangGraphInvokeSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({ agent,
      logger,
      packageName: '@langchain/langgraph',
      channelName: 'nr_invoke',
      name: `${LANGGRAPH.AGENT}/invoke`,
      trackingPrefix: LANGGRAPH.TRACKING_PREFIX })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    // Update segment name with LangGraph agent name.
    const aiAgentName = data?.self?.name ?? 'agent'
    this.name = `${LANGGRAPH.AGENT}/invoke/${aiAgentName}`
    return super.handler(data, ctx)
  }
}

module.exports = LangGraphInvokeSubscriber
