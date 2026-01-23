/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const AiMonitoringSubscriber = require('../ai-monitoring/base')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const LangGraphAgentEvent = require('#agentlib/llm-events/langgraph/agent.js')
const { AI: { LANGGRAPH } } = require('#agentlib/metrics/names.js')

class LangGraphStreamSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({ agent,
      logger,
      packageName: '@langchain/langgraph',
      channelName: 'nr_stream',
      name: `${LANGGRAPH.AGENT}/stream`,
      trackingPrefix: LANGGRAPH.TRACKING_PREFIX })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this.agent.config.ai_monitoring.streaming.enabled
  }

  handler(data, ctx) {
    // Update segment name with LangGraph agent name.
    const aiAgentName = data?.self?.name ?? 'agent'
    this.name = `${LANGGRAPH.AGENT}/stream/${aiAgentName}`
    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    // Get constants and exit early if need be
    const { agent, logger } = this
    if (!this.enabled) {
      logger.debug('LangGraph streaming instrumentation is disabled, not recording Llm events.')
      return
    }
    const ctx = agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    // Extract data
    const { error: initialErr, result: stream } = data
    const aiAgentName = data?.self?.name ?? 'agent'

    // Mark as LLM event
    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)

    // Add AI Agent component attribute
    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_AGENT", "name": ${aiAgentName}}`)

    // If error already:
    if (initialErr) {
      this.recordAiAgentEvent({ aiAgentName, transaction, segment, error: initialErr })
      return
    }

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (stream instanceof ReadableStream) {
      this.wrapNextHandler({ stream, segment, transaction, aiAgentName })
    }
  }

  wrapNextHandler({ stream, segment, transaction, aiAgentName }) {
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
          // update segment duration on every stream iteration to extend
          // the timer
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
