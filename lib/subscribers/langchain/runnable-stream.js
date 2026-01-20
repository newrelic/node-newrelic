/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AI: { LANGCHAIN, STREAMING_DISABLED } } = require('../../metrics/names')
const LangchainRunnableSubscriber = require('./runnable')

class LangchainRunnableStreamSubscriber extends LangchainRunnableSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_stream' })
    this.name = `${LANGCHAIN.CHAIN}/stream`
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, stream will not be instrumented.')
      return
    }

    const ctx = this.agent.tracer.getContext()

    if (!this.streamingEnabled) {
      this.logger.debug('`ai_monitoring.streaming.enabled` is set to false, stream will not be instrumented.')
      this.agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      return
    }

    const { transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    // Extract data.
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: response, error: err } = data

    // Instrument stream.
    if (response?.next) {
      this.wrapNextHandler({ response, ctx, request, metadata, tags })
    } else {
      // Input error occurred which means a stream was not created.
      // Skip instrumenting streaming and create Llm Events from
      // the data we have
      this.recordChatCompletionEvents({
        ctx,
        request,
        err,
        metadata,
        tags
      })
    }
  }

  /**
   * Wraps the next method on the IterableReadableStream. It will also record the Llm
   * events when the stream is done processing.
   *
   * @param {object} params function params
   * @param {Context} params.ctx active context
   * @param {Function} params.response IterableReadableStream
   * @param {string} params.request the prompt message
   * @param {object} params.metadata metadata for the call
   * @param {Array} params.tags tags for the call
   */
  wrapNextHandler({ ctx, response, request, metadata, tags }) {
    const self = this
    const orig = response.next
    let content = ''
    const { segment } = ctx

    async function wrappedIterator(...args) {
      try {
        const result = await orig.apply(this, args)
        // only create Llm events when stream iteration is done
        if (result?.done) {
          self.recordChatCompletionEvents({
            ctx,
            request,
            response: content,
            metadata,
            tags
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
          ctx,
          request,
          response: content,
          metadata,
          tags,
          err: error
        })
        throw error
      } finally {
        // update segment duration on every stream iteration to extend
        // the timer
        segment.touch()
      }
    }

    response.next = this.agent.tracer.bindFunction(wrappedIterator, ctx, false)
  }
}

module.exports = LangchainRunnableStreamSubscriber
