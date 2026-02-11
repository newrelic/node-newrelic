/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI } = require('#agentlib/metrics/names.js')
const semver = require('semver')
const MIN_STREAM_VERSION = '4.12.2'
const { LlmChatCompletionSummary, LlmChatCompletionMessage } = require('#agentlib/llm-events/openai/index.js')
const { wrapPromise } = require('../utils')

class OpenAIChatCompletions extends AiMonitoringChatSubscriber {
  constructor({ agent, logger, channelName = 'nr_completionsCreate' }) {
    super({ agent, logger, channelName, packageName: 'openai', trackingPrefix: AI.OPENAI.TRACKING_PREFIX, name: AI.OPENAI.COMPLETION })
    this.events = ['asyncEnd', 'end']
  }

  end(data) {
    wrapPromise.call(this, data)
  }

  handler(data, ctx) {
    const { arguments: args, moduleVersion } = data
    const [request] = args
    if (request.stream) {
      if (semver.lt(moduleVersion, MIN_STREAM_VERSION)) {
        this.logger.warn(`Instrumenting chat completion streams is only supported with openai version ${MIN_STREAM_VERSION}+.`)
        return ctx
      }
    }

    return super.handler(data, ctx)
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, stream will not be instrumented.')
      return
    }

    const { result: response, arguments: args, error: err } = data
    const [request] = args

    if (request.stream && !this.streamingEnabled) {
      this.logger.debug(
        '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
      )
      this.agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
      return
    }

    const ctx = this.agent.tracer.getContext()

    if (request.stream) {
      this.instrumentStream({
        ctx,
        request,
        response,
        err
      })
    } else {
      this.recordChatCompletionEvents({
        ctx,
        request,
        response,
        err
      })
    }
  }

  /**
   * `chat.completions.create` can return a stream once promise resolves.
   * This wraps the iterator which is a generator function.
   * We will call the original iterator, intercept chunks and yield
   * to the original. On complete, we will construct the new message object
   * with what we have seen in the stream and create the chat completion
   * messages.
   * @param {object} params input params
   * @param {object} params.ctx active context
   * @param {object} params.request chat completion params
   * @param {object} params.response chat completion response
   * @param {Error} [params.err] error if it exists
   */
  instrumentStream({ ctx, request, response, err = null }) {
    const self = this
    if (!(ctx?.segment || ctx?.transaction)) {
      this.logger.debug('Empty context, not instrumenting stream')
      return
    }

    if (err) {
      // If there is an error already e.g. APIConnectionError,
      // the iterator will not be called, so we have to
      // record the chat completion messages with the error now.
      this.recordChatCompletionEvents({
        ctx,
        request,
        response,
        err
      })
      return
    }

    const orig = response.iterator
    response.iterator = async function * wrappedIterator() {
      let content = ''
      let role = ''
      let finishReason = ''
      let chunk
      try {
        const iterator = orig.apply(this, arguments)

        for await (chunk of iterator) {
          if (chunk.choices?.[0]?.delta?.role) {
            role = chunk.choices[0].delta.role
          }

          if (chunk.choices?.[0]?.finish_reason) {
            finishReason = chunk.choices[0].finish_reason
          }

          content += chunk.choices?.[0]?.delta?.content ?? ''
          yield chunk
        }
      } catch (streamErr) {
        err = streamErr
        throw err
      } finally {
        // when `chunk.choices` is an array that means the completions API is being used
        // we must re-assign the finish reason, and construct a message object with role and content
        // This is because if `include_usage` is enabled, the last chunk only contains usage info and no message deltas
        if (Array.isArray(chunk?.choices)) {
          chunk.choices = [{ finish_reason: finishReason, message: { role, content } }]
        // This means it is the responses API and the entire message is in the response object
        } else if (chunk?.response) {
          chunk = chunk.response
        }

        self.recordChatCompletionEvents({
          ctx,
          request,
          response: chunk,
          err
        })
      }
    }
  }

  /**
   * Creates the OpenAI LlmChatCompletionSummary.
   * @param {object} params Function parameters.
   * @param {Context} params.ctx Current context.
   * @param {object} params.request OpenAI request object.
   * @param {object} [params.response] OpenAI response object, defaults to `{}`.
   * @param {object} [params.err] Error object if one occurred.
   * @returns {LlmChatCompletionSummary} The OpenAI LlmChatCompletionSummary instance.
   */
  createCompletionSummary({ ctx, request, response = {}, err = null }) {
    const { transaction, segment } = ctx
    const headers = ctx?.extras?.headers || {}
    const summary = new LlmChatCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      request,
      response: { ...response, headers },
      error: !!err
    })
    return summary
  }

  getMessages({ request, response }) {
    return [
      ...this.getMessagesFromRequest(request),
      ...this.getMessageFromResponse(response)
    ]
  }

  /**
   * Parses all messages from the OpenAI request object.
   *
   * @param {object} request The OpenAI SDK request object
   * @returns {Array<object>} an array of message objects with fields `content` and `role`
   */
  getMessagesFromRequest(request) {
    // There are a few different ways to pass messages to OpenAI SDK.
    //
    // For langchain and `chat.completions.create`, messages are passed
    // as an array of objects with `content` and `role` properties
    // to the `messages` field of the request.
    //
    // For `responses.create`, messages are passed as an array of objects
    // with `content` and `role` properties OR as a single string (implied
    // to be a user message) to the `input` field of the request.
    let messages = []

    if (Array.isArray(request?.input)) {
      // Handle array of input messages
      messages = request.input.filter((msg) => msg?.content && msg?.role)
    } else if (typeof request?.input === 'string') {
      // Handle single string input as a user message
      messages = [{ content: request.input, role: 'user' }]
    } else if (Array.isArray(request?.messages)) {
      // Handle array of messages
      messages = request.messages.filter((msg) => msg?.content && msg?.role)
    } else {
      this.logger.warn('No valid messages found in OpenAI request object.')
    }

    return messages
  }

  /**
   * Parses the response from OpenAI and extracts the message content and role.
   *
   * @param {object} response The OpenAI SDK response object
   * @returns {{ content: string, role: string }} the message object with fields `content` and `role`
   */
  getMessageFromResponse(response) {
    let content
    let role
    if (response?.object === 'response') {
      content = response.output?.[0]?.content?.[0]?.text
      role = response.output?.[0]?.role
    } else {
      const choice = response?.choices?.[0]
      // A false response. Don't create a LlmChatCompletionMessage for this
      // the full conversation will happen in another chat completion creation
      if (choice?.finish_reason === 'tool_calls') {
        return []
      }
      content = choice?.message?.content
      role = choice?.message?.role
    }

    return [{ content, role }]
  }

  createCompletionMessage({ ctx, request, response, index, completionId, message }) {
    const { transaction, segment } = ctx
    const headers = ctx?.extras?.headers || {}

    // Check if the given message is the response.
    // The response object differs based on the API called.
    // If it's `responses.create`, we check against `response.output`.
    // If it's `chat.completions.create`, we check against `response.choices`.
    let isResponse
    if (response?.object === 'response') {
      isResponse = message.content === response.output?.[0]?.content?.[0]?.text
    } else if (response?.object?.includes('chat.completion')) {
      isResponse = message.content === response.choices?.[0]?.message?.content
    }

    return new LlmChatCompletionMessage({
      agent: this.agent,
      segment,
      transaction,
      request,
      response: { ...response, headers },
      sequence: index,
      completionId,
      message,
      isResponse
    })
  }
}

module.exports = OpenAIChatCompletions
