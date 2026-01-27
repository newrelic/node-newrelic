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
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, stream will not be instrumented.')
      return
    }
    if (!this.streamingEnabled) {
      this.logger.debug('`ai_monitoring.streaming.enabled` is set to false, stream will not be instrumented.')
      this.agent.metrics.getOrCreateMetric(STREAMING_DISABLED).incrementCallCount()
      return
    }

    const ctx = this.agent.tracer.getContext()
    const { transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    const request = data?.arguments?.[0]
    // Requests via LangGraph API have the `messages` property with the
    // information we need, otherwise it just lives on the `request`
    // object directly.
    const userRequest = request?.messages ? request.messages?.[0] : request
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: response, error: err } = data

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (response instanceof ReadableStream) {
      this.instrumentStream({ response, ctx, request: userRequest, metadata, tags })
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
  instrumentStream({ ctx, response, request, metadata, tags }) {
    const self = this
    const orig = response.getReader
    response.getReader = function wrapedGetReader() {
      const reader = orig.apply(this, arguments)
      const origRead = reader.read
      const accumulator = { content: '', langgraphMessages: [] }
      reader.read = async function wrappedRead(...args) {
        try {
          const result = await origRead.apply(this, args)
          if (result?.done) {
            // only create Llm events when stream iteration is done
            const responseMsgs = self.getResponseMessages(
              accumulator.langgraphMessages,
              accumulator.content
            )
            self.recordChatCompletionEvents({
              ctx,
              response: responseMsgs,
              request,
              metadata,
              tags
            })
          } else {
            // Concat the streamed content
            self.accumulateStreamContent(result, accumulator)
          }
          return result
        } catch (error) {
          const responseMsgs = self.getResponseMessages(
            accumulator.langgraphMessages,
            accumulator.content
          )
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
          // update segment duration on every stream
          // iteration to extend the timer
          ctx.segment.touch()
        }
      }
      return reader
    }
  }

  /**
   * Accumulates streamed content from various LangChain/LangGraph result formats.
   *
   * @param {object} result the stream result chunk
   * @param {object} accumulator object containing content string and langgraphMessages array
   */
  accumulateStreamContent(result, accumulator) {
    if (result?.value?.messages || result?.value?.agent?.messages) {
      // LangGraph case:
      // The result.value.messages field contains all messages,
      // request and response, and adds new events for the length
      // of the stream. The last iteration will contain all messages
      // in the stream, so we can just re-assign `langgraphMessages`.
      accumulator.langgraphMessages = result?.value?.messages ?? result?.value?.agent?.messages
    } else if (typeof result?.value?.content === 'string') {
      // LangChain MessageChunk case
      accumulator.content += result.value.content
    } else if (typeof result?.value === 'string') {
      // Base LangChain case
      accumulator.content += result.value
    } else if (typeof result?.value?.[0] === 'string') {
      // LangChain array parser case
      accumulator.content += result.value[0]
    }
  }

  /**
   * Extracts response messages from accumulated stream data.
   * For LangGraph, filters out HumanMessages.
   * For LangChain, returns concatenated content.
   *
   * @param {object[]} langgraphMessages accumulated LangGraph messages
   * @param {string} content accumulated LangChain content
   * @returns {object[]|string} the response messages
   */
  getResponseMessages(langgraphMessages, content) {
    return langgraphMessages.length > 0
      ? langgraphMessages.filter((msg) => msg.constructor?.name !== 'HumanMessage')
      : content
  }
}

module.exports = LangchainRunnableStreamSubscriber
