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

    const agentName = data?.self?.name ?? 'agent'

    const segment = this.agent.tracer.createSegment({
      name: `${LANGGRAPH.AGENT}/stream/${agentName}`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
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
      this._recordAgentEventWithError(agent, name, transaction, segment, pkgVersion, initialErr)
      return
    }

    // Wrap stream (IterableReadableStreamWithAbortSignal)
    if (stream?.[Symbol.asyncIterator]) {
      const self = this
      const proto = Object.getPrototypeOf(stream)
      // proto is IterableReadableStream which is already
      // wrapped by LangChain instrumentation
      const originalAsyncIteratorMethod = proto[Symbol.asyncIterator]

      // Wrap the wrapped stream
      Object.defineProperty(proto, Symbol.asyncIterator, {
        value: function() {
          const iterator = originalAsyncIteratorMethod.call(this)
          const originalNext = iterator.next.bind(iterator)

          return {
            next: async (...args) => {
              try {
                const result = await originalNext(...args)
                if (result?.done) {
                  const agentEvent = new LangGraphAgentEvent({
                    agent,
                    name,
                    transaction,
                    segment,
                    error: false
                  })
                  self.recordEvent({ type: 'LlmAgent', pkgVersion, msg: agentEvent })
                  segment.end()
                }
                return result
              } catch (err) {
                self._recordAgentEventWithError(agent, name, transaction, segment, pkgVersion, err)
                throw err
              } finally {
                segment.touch()
              }
            },
            return: iterator.return?.bind(iterator),
            throw: iterator.throw?.bind(iterator)
          }
        },
        writable: true,
        enumerable: false,
        configurable: true
      })
    }
  }

  _recordAgentEventWithError(agent, name, transaction, segment, pkgVersion, error) {
    const agentEvent = new LangGraphAgentEvent({
      agent,
      name,
      transaction,
      segment,
      error: true
    })
    this.recordEvent({ type: 'LlmAgent', pkgVersion, msg: agentEvent })

    agent.errors.add(
      transaction,
      error,
      new LlmErrorMessage({
        response: {},
        cause: error,
        agent: agentEvent
      })
    )

    segment.end()
  }
}

module.exports = LangGraphStreamSubscriber
