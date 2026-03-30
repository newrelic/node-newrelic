/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI } = require('#agentlib/metrics/names.js')
const { ANTHROPIC } = AI
const { LlmChatCompletionSummary, LlmChatCompletionMessage } = require('#agentlib/llm-events/anthropic-sdk/index.js')
const { wrapPromise } = require('../utils')

module.exports = class AnthropicChatCreateSubscriber extends AiMonitoringChatSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_create',
      packageName: '@anthropic-ai/sdk',
      trackingPrefix: ANTHROPIC.TRACKING_PREFIX,
      name: ANTHROPIC.COMPLETION
    })
    this.events = ['asyncEnd', 'end']
  }

  /**
   * The end handler calls wrapPromise which attaches .then(resolve, reject)
   * to the APIPromise. When the promise settles, it publishes asyncEnd with
   * the actual response (or error). Without this bridge, asyncEnd never fires.
   * @param {object} data event data
   */
  end(data) {
    wrapPromise.call(this, data)
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not creating chat completion events.')
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
      this.instrumentStream({ ctx, request, response, err })
    } else {
      this.recordChatCompletionEvents({ ctx, request, response, err })
    }
  }

  instrumentStream({ ctx, request, response, err = null }) {
    const self = this
    if (!(ctx?.segment || ctx?.transaction)) {
      this.logger.debug('Empty context, not instrumenting stream')
      return
    }

    if (err) {
      this.recordChatCompletionEvents({ ctx, request, response, err })
      return
    }

    const orig = response[Symbol.asyncIterator].bind(response)
    response[Symbol.asyncIterator] = async function * wrappedIterator() {
      const state = { content: '', role: '', stopReason: '', model: '', responseId: '', usage: {} }
      let timeOfFirstToken
      let streamErr

      try {
        for await (const event of orig()) {
          timeOfFirstToken = self.processStreamEvent(event, state, timeOfFirstToken)
          yield event
        }
      } catch (iterErr) {
        streamErr = iterErr
        throw iterErr
      } finally {
        const composedResponse = {
          id: state.responseId,
          model: state.model,
          role: state.role,
          stop_reason: state.stopReason,
          usage: state.usage,
          content: [{ type: 'text', text: state.content }]
        }

        self.recordChatCompletionEvents({
          ctx,
          request,
          response: composedResponse,
          timeOfFirstToken,
          err: streamErr
        })
      }
    }
  }

  processStreamEvent(event, state, timeOfFirstToken) {
    if (event.type === 'message_start' && event.message) {
      state.model = event.message.model || ''
      state.responseId = event.message.id || ''
      state.role = event.message.role || 'assistant'
      if (event.message.usage) {
        Object.assign(state.usage, event.message.usage)
      }
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      if (!timeOfFirstToken) {
        timeOfFirstToken = Date.now()
      }
      state.content += event.delta.text || ''
    } else if (event.type === 'message_delta') {
      state.stopReason = event.delta?.stop_reason || state.stopReason
      if (event.usage) {
        state.usage.output_tokens = event.usage.output_tokens
      }
    }
    return timeOfFirstToken
  }

  createCompletionSummary({ ctx, request, response = {}, timeOfFirstToken, err = null }) {
    const { transaction, segment } = ctx
    return new LlmChatCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      timeOfFirstToken,
      error: !!err
    })
  }

  getMessages({ request, response = {} }) {
    const messages = []

    // Add request messages
    if (Array.isArray(request?.messages)) {
      for (const msg of request.messages) {
        let content
        if (typeof msg.content === 'string') {
          content = msg.content
        } else if (Array.isArray(msg.content)) {
          content = msg.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('')
        }
        if (content) {
          messages.push({ content, role: msg.role })
        }
      }
    }

    // Add response message
    const responseContent = response?.content
    if (Array.isArray(responseContent)) {
      const text = responseContent
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
      if (text) {
        messages.push({ content: text, role: response.role || 'assistant' })
      }
    }

    return messages
  }

  createCompletionMessage({ ctx, request, response, index, completionId, message }) {
    const { segment, transaction } = ctx

    // Determine if this message is the response by comparing content
    const responseText = response?.content
      ?.filter?.((block) => block.type === 'text')
      ?.map?.((block) => block.text)
      ?.join?.('')

    const isResponse = message.content === responseText

    return new LlmChatCompletionMessage({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      sequence: index,
      completionId,
      content: message.content,
      role: message.role,
      isResponse
    })
  }
}
