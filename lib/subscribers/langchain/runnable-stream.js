/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const { AI: { LANGCHAIN, STREAMING_DISABLED } } = require('../../metrics/names')

class LangchainRunnableStreamSubscriber extends LangchainSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_stream' })
  }

  get enabled() {
    return super.enabled && this.streamingEnabled
  }

  get streamingEnabled() {
    return this.agent.config.ai_monitoring.streaming.enabled
  }

  handler(data, ctx) {
    const { agent, logger } = this
    if (!this.enabled) {
      logger.debug('Langchain instrumentation is disabled, not creating segment.')
      return ctx
    }

    // Create segment
    const segment = agent.tracer.createSegment({
      name: `${LANGCHAIN.CHAIN}/stream`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    const { agent, logger } = this
    // Exit early if need be.
    if (!this.enabled) {
      if (!this.streamingEnabled) {
        logger.warn('Langchain streaming instrumentation is disabled, stream will not be instrumented.')
        agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      }
      agent.metrics
        .getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${data?.moduleVersion}`)
        .incrementCallCount()
      return
    }
    const ctx = this.agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    // Extract data.
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: output, error: err, moduleVersion: pkgVersion } = data

    // Instrument stream.
    if (output?.next) {
      this.wrapNextHandler({ output, segment, request, metadata, tags, transaction, pkgVersion })
    } else {
      // Input error occurred which means a stream was not created.
      // Skip instrumenting streaming and create Llm Events from
      // the data we have
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
          // Concat the streamed content
          if (typeof result?.value?.content === 'string') {
            // LangChain BaseMessageChunk case
            content += result.value.content
          } else if (typeof result?.value === 'string') {
            // Base LangChain case
            content += result.value
          } else if (typeof result?.value?.[0] === 'string') {
            // Array parser case
            content += result.value[0]
          }
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
