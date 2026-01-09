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
    const userRequest = request?.messages ? request.messages?.[0] : request
    const params = data?.arguments?.[1] || {}
    const metadata = params?.metadata ?? {}
    const tags = params?.tags ?? []
    const { result: output, error: err, moduleVersion: pkgVersion } = data

    // Note: as of 18.x `ReadableStream` is a global
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if (output instanceof ReadableStream) {
      this.wrapNextHandler({ output, segment, request: userRequest, metadata, tags, transaction, pkgVersion })
    } else {
      // Input error occurred which means a stream was not created.
      // Skip instrumenting streaming and create Llm Events from
      // the data we have
      this.recordChatCompletionEvents({
        transaction,
        segment,
        messages: [],
        events: [userRequest],
        metadata,
        tags,
        err,
        pkgVersion
      })
    }
  }

  /**
   * Wraps `read` method on the ReadableStream reader. It will also record the Llm
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
    const orig = output.getReader
    output.getReader = function wrapedGetReader() {
      const reader = orig.apply(this, arguments)
      const origRead = reader.read
      let content = ''
      let langgraphMessages = []
      reader.read = async function wrappedRead(...args) {
        try {
          const result = await origRead.apply(this, args)
          // only create Llm events when stream iteration is done
          if (result?.done) {
            const { responseMsgs, allMsgs } = self._getMessages(langgraphMessages, request, content)
            self.recordChatCompletionEvents({
              transaction,
              segment,
              messages: responseMsgs,
              events: allMsgs,
              metadata,
              tags,
              pkgVersion
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
      return reader
    }
  }

  /**
   * Extracts response messages and all messages from stream data to normalize
   * the different formats returned by LangChain vs LangGraph streams.
   *
   * LangChain streams return content strings that need to be combined with the request.
   * LangGraph streams return message objects (HumanMessage, AIMessage, ToolMessage) that
   * may or may not include a HumanMessage request (could have been a different object
   * for the request).
   *
   * @param {object[]} langgraphMessages An array of messages with objects HumanMessage, AIMessage, and ToolMessage.
   * @param {object|string} request The initial user request, could be a HumanMessage, `{ content, role }`, just a string, or some other object.
   * @param {string} content The concatenated string response from the stream; the response content.
   * @returns {object} { responseMsgs: Array of response messages only, allMsgs: Array of all messages including the request }
   */
  _getMessages(langgraphMessages = [], request, content) {
    const humanMsgs = langgraphMessages.filter((msg) => msg.constructor?.name === 'HumanMessage')
    const responseMsgs = langgraphMessages.length > 0
      ? langgraphMessages.filter((msg) => msg.constructor?.name !== 'HumanMessage')
      : [content]

    const allMsgs = humanMsgs.length === 0
      ? [request, ...responseMsgs]
      : langgraphMessages

    return { responseMsgs, allMsgs }
  }
}

module.exports = LangchainRunnableStreamSubscriber
