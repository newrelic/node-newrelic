/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const { extractLlmContext } = require('#agentlib/util/llm-utils.js')
const { AI: { LANGGRAPH } } = require('#agentlib/metrics/names.js')

class LangGraphSubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({ agent, logger, channelName, packageName: '@langchain/langgraph' })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this.agent.config.ai_monitoring.enabled
  }

  /**
   * Helper to enqueue a LLM event into the custom event aggregator. This will also
   * increment the Supportability metric that's used to derive a tag on the APM entity.
   *
   * TODO: move to a base AIM subscriber
   *
   * @param {object} params function params
   * @param {string} params.type type of llm event (LlmTool, LlmChatCompletionMessage, etc.)
   * @param {object} params.msg the llm event getting enqueued
   * @param {string} params.pkgVersion version of langgraph library instrumented
   */
  recordEvent({ type, msg, pkgVersion }) {
    const { agent } = this
    agent.metrics.getOrCreateMetric(`${LANGGRAPH.TRACKING_PREFIX}/${pkgVersion}`).incrementCallCount()
    const llmContext = extractLlmContext(agent)

    agent.customEventAggregator.add([
      { type, timestamp: Date.now() },
      Object.assign({}, msg, llmContext)
    ])
  }
}

module.exports = LangGraphSubscriber
