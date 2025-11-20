/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const { AI: { LANGCHAIN, STREAMING_DISABLED } } = require('../../metrics/names')

class LangchainRunnableStreamSubscriber extends LangchainSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_stream' })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this?.agent?.config?.ai_monitoring?.streaming?.enabled
  }

  handler(data, ctx) {
    const { agent, logger } = this
    // We need these checks inside the handler because it is possible for monitoring
    // to be disabled at the account level. In such a case, the value is set
    // after the instrumentation has been initialized.
    if (!agent?.config?.ai_monitoring?.enabled) {
      this.logger.debug('Langchain instrumentation is disabled. To enable, set `config.ai_monitoring.enabled` to true.')
      return ctx
    }
    if (!agent.config?.ai_monitoring?.streaming?.enabled) {
      logger.warn('`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.')
      agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      agent.metrics
        .getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${data?.moduleVersion}`)
        .incrementCallCount()
      return ctx
    }

    const segment = agent.tracer.createSegment({
      name: `${LANGCHAIN.CHAIN}/stream`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: output, error: err, moduleVersion: pkgVersion } = data

    // Input error occurred which means a stream was not created.
    // Skip instrumenting streaming and create Llm Events from
    // the data we have
    if (output?.next) {
      this.wrapNextHandler({ output, segment, request, metadata, tags, transaction, pkgVersion })
    } else {
      this.recordChatCompletionEvents({
        transaction,
        segment,
        messages: [],
        events: [request],
        metadata,
        tags,
        err,
        pkgVersion
      })
    }
  }

  /**
   * Wraps the next method on the IterableReadableStream. It will also record the Llm
   * events when the stream is done processing.
   *
   * @param {object} params function params
   * @param {TraceSegment} params.segment active segment
   * @param {Function} params.output IterableReadableStream
   * @param {string} params.request the prompt message
   * @param {object} params.metadata metadata for the call
   * @param {Array} params.tags tags for the call
   * @param {Transaction} params.transaction active transaction
   * @param {string} params.pkgVersion module version of @langchain/core
   */
  wrapNextHandler({ output, segment, transaction, request, metadata, tags, pkgVersion }) {
    const self = this
    const orig = output.next
    const ctx = this.agent.tracer.getContext()
    let content = ''

    async function wrappedIterator(...args) {
      try {
        const result = await orig.apply(this, args)
        // only create Llm events when stream iteration is done
        if (result?.done) {
          self.recordChatCompletionEvents({
            transaction,
            segment,
            messages: [content],
            events: [request, content],
            metadata,
            tags,
            pkgVersion
          })
        } else {
          content += result.value
        }
        return result
      } catch (error) {
        self.recordChatCompletionEvents({
          transaction,
          segment,
          messages: [content],
          events: [request, content],
          metadata,
          tags,
          err: error,
          pkgVersion
        })
        throw error
      } finally {
        // update segment duration on every stream iteration to extend
        // the timer
        segment.touch()
      }
    }

    output.next = this.agent.tracer.bindFunction(wrappedIterator, ctx, false)
  }
}

module.exports = LangchainRunnableStreamSubscriber
