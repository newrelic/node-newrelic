/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const LlmAgent = require('#agentlib/llm-events/ai-agent.js')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const { AI: { GOOGLE_ADK } } = require('#agentlib/metrics/names.js')

module.exports = class GoogleAdkAgentRunSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      packageName: '@google/adk',
      channelName: 'nr_agentRunAsync',
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
    const { agent, logger } = this
    if (!this.enabled) {
      logger.debug('Google ADK instrumentation is disabled, not instrumenting runAsync.')
      return
    }

    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (!(segment || transaction) || (transaction?.isActive() !== true)) {
      return
    }
    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_AGENT", "name": "${this.aiAgentName}"}`)

    const { result: generator } = data
    if (generator && typeof generator[Symbol.asyncIterator] === 'function') {
      this.#instrumentGenerator({ generator, ctx })
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
   */
  #instrumentGenerator({ ctx, generator }) {
    const self = this
    const origNext = generator.next

    generator.next = async function wrappedNext(...args) {
      try {
        // Bind to the segment context so that child instrumentation
        // (e.g. Gemini) creates spans as children of this agent span.
        const boundNext = self.agent.tracer.bindFunction(origNext, ctx)
        const result = await boundNext.apply(this, args)
        if (result?.done) {
          self.#recordAgentEvent({ ctx, error: false })
        }
        return result
      } catch (err) {
        self.#recordAgentEvent({ ctx, error: true })
        throw err
      }
    }
  }

  /**
   * Records a Google ADK LlmAgent event.
   *
   * @param {object} params function parameters
   * @param {object} params.ctx The active tracer context containing the segment and transaction
   * @param {boolean} params.error Whether an error occurred
   */
  #recordAgentEvent({ ctx, error }) {
    const { agent, aiAgentName } = this
    const { segment, transaction } = ctx
    segment.end()
    const agentEvent = new LlmAgent({
      agent,
      segment,
      transaction,
      aiAgentName,
      vendor: 'google_adk',
      error: error || undefined
    })

    this.recordEvent({ type: 'LlmAgent', msg: agentEvent })

    if (error) {
      agent.errors.add(
        transaction,
        error,
        new LlmErrorMessage({
          response: {},
          cause: error,
          aiAgent: agentEvent
        })
      )
    }
  }
}
