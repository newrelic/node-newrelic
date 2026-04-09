/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const LlmAgent = require('#agentlib/llm-events/ai-agent.js')
const { AI: { GOOGLE_ADK } } = require('#agentlib/metrics/names.js')

module.exports = class GoogleAdkAgentRunSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: '@google/adk',
      channelName: 'nr_runAsync',
      name: `${GOOGLE_ADK.AGENT}/runAsync/agent`,
      trackingPrefix: GOOGLE_ADK.TRACKING_PREFIX
    })
    this.events = ['end']
  }

  handler(data, ctx) {
    this.aiAgentName = data?.self?.name ?? 'agent'
    this.name = `${GOOGLE_ADK.AGENT}/runAsync/${this.aiAgentName}`
    return super.handler(data, ctx)
  }

  // BaseAgent.runAsync is an async generator. The tracePromise wrapper returns
  // the generator object synchronously (it has no .then), so `asyncEnd` is
  // never published. We use `end` instead, which fires right after the
  // generator is created but before it is consumed by the caller.
  end(data) {
    const { agent, logger, aiAgentName } = this
    if (!this.enabled) {
      logger.debug('Google ADK instrumentation is disabled, not instrumenting runAsync.')
      return
    }

    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (!(segment || transaction) || (transaction?.isActive() !== true)) {
      return
    }

    const { result: generator } = data

    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_AGENT", "name": "${aiAgentName}"}`)

    if (generator && typeof generator[Symbol.asyncIterator] === 'function') {
      this.#instrumentGenerator({ generator, segment, transaction, aiAgentName, ctx })
    }
  }

  /**
   * Wraps the async generator returned by BaseAgent.runAsync() so that
   * child instrumentation (e.g. Gemini, FunctionTool) runs within the
   * agent segment context. Records the LlmAgent event when the generator
   * completes or throws.
   *
   * @param {object} params function parameters
   * @param {object} params.ctx The NR async context to bind generator calls to
   * @param {AsyncGenerator} params.generator The async generator from runAsync
   * @param {object} params.segment The current NR segment
   * @param {object} params.transaction The active NR transaction
   * @param {string} params.aiAgentName The AI agent name
   */
  #instrumentGenerator({ ctx, generator, segment, transaction, aiAgentName }) {
    const self = this
    const origNext = generator.next
    const { agent } = this

    generator.next = async function wrappedNext(...args) {
      try {
        // Bind to the segment context so that child instrumentation
        // (e.g. Gemini) creates spans as children of this agent span.
        const boundNext = agent.tracer.bindFunction(origNext, ctx)
        const result = await boundNext.apply(this, args)
        if (result?.done) {
          self.#recordAgentEvent({ aiAgentName, transaction, segment, error: false })
        }
        return result
      } catch (err) {
        self.#recordAgentEvent({ aiAgentName, transaction, segment, error: true })
        throw err
      } finally {
        segment.touch()
      }
    }
  }

  /**
   * Records a Google ADK LlmAgent event.
   *
   * @param {object} params function parameters
   * @param {string} params.aiAgentName The AI agent name
   * @param {object} params.transaction The active NR transaction
   * @param {object} params.segment The current NR segment
   * @param {boolean} params.error Whether an error occurred
   */
  #recordAgentEvent({ aiAgentName, transaction, segment, error }) {
    segment.end()
    const agentEvent = new LlmAgent({
      agent: this.agent,
      segment,
      transaction,
      aiAgentName,
      vendor: 'adk',
      error: error || undefined
    })

    this.recordEvent({ type: 'LlmAgent', msg: agentEvent })
  }
}
