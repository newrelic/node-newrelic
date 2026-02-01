/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const LangGraphAgentEvent = require('#agentlib/llm-events/langgraph/agent.js')
const { AI: { LANGGRAPH, STREAMING_DISABLED } } = require('#agentlib/metrics/names.js')

class LangGraphStreamSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({ agent,
      logger,
      packageName: '@langchain/langgraph',
      channelName: 'nr_stream',
      // 'agent' is the default name for an unknown AI
      // agent or one with no name
      name: `${LANGGRAPH.AGENT}/stream/agent`,
      trackingPrefix: LANGGRAPH.TRACKING_PREFIX })
    this.events = ['asyncEnd']
  }

  get streamingEnabled() {
    return this.agent.config.ai_monitoring.streaming.enabled
  }

  handler(data, ctx) {
    // Store LangGraph AI agent name and update
    // segment name to use it.
    this.aiAgentName = data?.self?.name ?? 'agent'
    this.name = `${LANGGRAPH.AGENT}/stream/${this.aiAgentName}`
    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    const { agent, logger, aiAgentName } = this
    if (!this.enabled) {
      logger.debug('LangGraph instrumentation is disabled, not instrumenting stream.')
      return
    }
    if (!this.streamingEnabled) {
      logger.debug('LangGraph streaming instrumentation is disabled, not instrumenting stream.')
      this.agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      return
    }
    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (!(segment || transaction) || (transaction?.isActive() !== true)) {
      return
    }

    const { error: initialErr, result: stream } = data
    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_AGENT", "name": ${aiAgentName}}`)

    if (initialErr) {
      this.recordAiAgentEvent({ aiAgentName, transaction, segment, error: initialErr })
      return
    }

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (stream instanceof ReadableStream) {
      this.instrumentStream({ stream, segment, transaction, aiAgentName })
    }
  }

  instrumentStream({ stream, segment, transaction, aiAgentName }) {
    const self = this
    const orig = stream.getReader
    stream.getReader = function wrappedGetReaderLangGraph() {
      const reader = orig.apply(this, arguments)
      const origRead = reader.read
      reader.read = async function wrappedLangGraphRead(...args) {
        try {
          const result = await origRead.apply(this, args)
          if (result?.done) {
            self.recordAiAgentEvent({ aiAgentName, transaction, segment, error: false })
          }
          return result
        } catch (err) {
          self.recordAiAgentEvent({ aiAgentName, transaction, segment, error: err })
          throw err
        } finally {
          // update segment duration on every stream
          // iteration to extend the timer
          segment.touch()
        }
      }
      return reader
    }
  }

  /**
   * Records a LangGraph `LlmAgent` event and a `LlmErrorMessage` event
   * if an error occurred.
   *
   * @param {object} params function parameters
   * @param {string} params.aiAgentName LangGraph AI agent name
   * @param {object} params.transaction current transaction
   * @param {object} params.segment current segment
   * @param {object} [params.error] an error if it occurred
   */
  recordAiAgentEvent({ aiAgentName, transaction, segment, error }) {
    const { agent } = this
    segment.end()
    const agentEvent = new LangGraphAgentEvent({
      agent,
      name: aiAgentName,
      transaction,
      segment,
      error: !!error
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

module.exports = LangGraphStreamSubscriber
