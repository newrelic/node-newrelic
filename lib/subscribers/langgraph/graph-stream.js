/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangGraphSubscriber = require('./base')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const LangGraphAgentEvent = require('#agentlib/llm-events/langgraph/agent.js')
const { AI: { LANGGRAPH } } = require('#agentlib/metrics/names.js')

class LangGraphStreamSubscriber extends LangGraphSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_stream' })
  }

  get enabled() {
    return super.enabled && this.agent.config.ai_monitoring.streaming.enabled
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('LangGraph streaming instrumentation is disabled, not creating segment.')
      return ctx
    }

    // Create segment and return the context with it.
    const agentName = data?.self?.name ?? 'agent'
    return this.createSegment({
      name: `${LANGGRAPH.AGENT}/stream/${agentName}`,
      ctx
    })
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
    const { moduleVersion: pkgVersion, error: initialErr, result: stream } = data
    const name = data?.self?.name ?? 'agent'

    // Mark as LLM event
    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)

    // Add AI Agent component attribute
    segment.addSpanAttribute('subcomponent', `{"type": "APM-AI_AGENT", "name": ${name}}`)

    // If error already:
    if (initialErr) {
      this.recordAgentEvent({ name, transaction, segment, pkgVersion, error: initialErr })
      return
    }

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (stream instanceof ReadableStream) {
      this.wrapNextHandler({ stream, segment, transaction, pkgVersion, name })
    }
  }

  wrapNextHandler({ stream, segment, transaction, pkgVersion, name }) {
    const self = this
    const orig = stream.getReader
    stream.getReader = function wrappedGetReaderLangGraph() {
      const reader = orig.apply(this, arguments)
      const origRead = reader.read
      reader.read = async function wrappedLangGraphRead(...args) {
        try {
          const result = await origRead.apply(this, args)
          if (result?.done) {
            self.recordAgentEvent({ name, transaction, segment, pkgVersion, error: false })
          }
          return result
        } catch (err) {
          self.recordAgentEvent({ name, transaction, segment, pkgVersion, error: err })
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

  recordAgentEvent({ name, transaction, segment, pkgVersion, error }) {
    const { agent } = this
    segment.end()
    const agentEvent = new LangGraphAgentEvent({
      agent,
      name,
      transaction,
      segment,
      error: error !== null
    })

    this.recordEvent({ type: 'LlmAgent', pkgVersion, msg: agentEvent })

    if (error) {
      agent.errors.add(
        transaction,
        error,
        new LlmErrorMessage({
          response: {},
          cause: error,
          agent: agentEvent
        })
      )
    }
  }
}

module.exports = LangGraphStreamSubscriber
