/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AI: { LANGCHAIN, STREAMING_DISABLED } } = require('../../metrics/names')
const LangchainRunnableSubscriber = require('./runnable')

class LangchainRunnableStreamSubscriber extends LangchainRunnableSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_stream', name: `${LANGCHAIN.CHAIN}/stream` })
  }

  asyncEnd(data) {
    // Exit early if disabled.
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, stream will not be instrumented.')
      return
    }
    if (!this.streamingEnabled) {
      this.logger.debug('`ai_monitoring.streaming.enabled` is set to false, stream will not be instrumented.')
      this.agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      return
    }

    // Get context.
    const ctx = this.agent.tracer.getContext()
    const { transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    // Extract data.
    const request = data?.arguments?.[0]
    const userRequest = request?.messages ? request.messages?.[0] : request
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: response, error: err } = data

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (response instanceof ReadableStream) {
      this.wrapNextHandler({ response, ctx, request: userRequest, metadata, tags })
    } else {
      // Input error occurred which means a stream was not created.
      // Skip instrumenting streaming and create Llm Events from
      // the data we have
      this.recordChatCompletionEvents({
        ctx,
        request: userRequest,
        err,
        metadata,
        tags
      })
    }
  }

  /**
   * Wraps `read` method on the ReadableStream reader. It will also record the Llm
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
    const orig = response.getReader
    response.getReader = function wrapedGetReader() {
      const reader = orig.apply(this, arguments)
      const origRead = reader.read
      let content = ''
      let langgraphMessages = []
      reader.read = async function wrappedRead(...args) {
        try {
          const result = await origRead.apply(this, args)
          if (result?.done) {
            // only create Llm events when stream iteration is done
            const responseMsgs = langgraphMessages.length > 0
              ? langgraphMessages.filter((msg) => msg.constructor?.name !== 'HumanMessage')
              : content
            self.recordChatCompletionEvents({
              ctx,
              response: responseMsgs,
              request,
              metadata,
              tags
            })
          } else {
            // Concat the streamed content
            if (result?.value?.messages || result?.value?.agent?.messages) {
              // LangGraph case:
              // The result.value.messages field contains all messages,
              // request and response, and adds new events for the length
              // of the stream. The last iteration will contain all messages
              // in the stream so we can just re-assign it.
              langgraphMessages = result?.value?.messages ?? result?.value?.agent?.messages
            } else if (typeof result?.value?.content === 'string') {
              // LangChain MessageChunk case
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
          const responseMsgs = langgraphMessages.length > 0
            ? langgraphMessages.filter((msg) => msg.constructor?.name !== 'HumanMessage')
            : content
          self.recordChatCompletionEvents({
            ctx,
            request,
            response: responseMsgs,
            metadata,
            tags,
            err: error
          })
          throw error
        } finally {
          // update segment duration on every stream iteration to extend
          // the timer
          ctx.segment.touch()
        }
      }
      return reader
    }
  }
}

module.exports = LangchainRunnableStreamSubscriber
