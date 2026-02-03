/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI: { LANGCHAIN } } = require('../../metrics/names')
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary
} = require('#agentlib/llm-events/langchain/index.js')
const { langchainRunId } = require('#agentlib/symbols.js')

class LangchainRunnableSubscriber extends AiMonitoringChatSubscriber {
  constructor ({ agent, logger, channelName = 'nr_invoke', name = `${LANGCHAIN.CHAIN}/invoke` }) {
    super({ agent, logger, packageName: '@langchain/core', channelName, name, trackingPrefix: LANGCHAIN.TRACKING_PREFIX })
    this.events = ['asyncEnd']
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { result, error: err } = data
    // Requests and responses via LangGraph API have the `messages`
    // property with the information we need, otherwise it just
    // lives on the `request`/`result` object directly.
    const userRequest = request?.messages ? request.messages?.[0] : request
    const response = result?.messages ? result.messages?.[0] : result
    this.recordChatCompletionEvents({
      ctx,
      request: userRequest,
      response,
      err,
      metadata: params?.metadata,
      tags: params?.tags
    })
  }

  createCompletionSummary({ ctx, response, err, metadata, tags }) {
    const { segment, transaction } = ctx
    // Stream calls that error on initial call lack a response message
    // so create an empty array in that case
    const messages = response ? [response] : []
    return new LlmChatCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      error: !!err,
      numMsgs: messages?.length,
      runId: segment[langchainRunId],
      metadata,
      tags
    })
  }

  /**
   * Determines if the LangChain request and response should be stored and
   * later captured as `LlmChatCompletionMessage`s.
   * @param {object} params function parameters
   * @param {object|string} params.request request object (`{ content, role, ... }`) or string
   * @param {object|string} params.response response object (`{ content, role, ... }`) or string
   * @returns {object[]} an array with all of the valid request and response objects/strings
   */
  getMessages({ request, response }) {
    const messages = []
    if (request || request === '') {
      messages.push(request)
    }

    if (response || response === '') {
      // Add the response if it is NOT an outgoing
      // tool call with no result yet
      if (!(response?.content === '' && response?.tool_calls?.length > 0)) {
        messages.push(response)
      }
    }

    return messages
  }

  createCompletionMessage({ ctx, response, index, completionId, message }) {
    const { segment, transaction } = ctx
    // check before grabbing a key from it in the AiMessageChunk case
    const isResponse = message === response
    const { content, role } = this.extractContentAndRole(message)

    return new LlmChatCompletionMessage({
      sequence: index,
      agent: this.agent,
      content,
      role,
      completionId,
      segment,
      transaction,
      runId: segment[langchainRunId],
      isResponse
    })
  }

  /**
   * Grabs the message content and conversation role from the given
   * LangChain message object.
   * @param {object|string} msg The message, can be a variety of different types.
   * @returns {object} an object with `content` (string) and `role` (string)
   */
  extractContentAndRole(msg) {
    // Get message content
    let content = ''
    if (typeof msg === 'string') {
      content = msg
    } else if (typeof msg?.content === 'string') {
      // If msg is a BaseMessage
      content = msg.content
    } else {
      // Fallback for different kind of message
      try {
        content = JSON.stringify(msg)
      } catch (error) {
        this.logger.error(error, 'Failed to stringify message')
      }
    }

    // Get conversation role
    let role = msg?.role
    if (msg?.type) {
      // LangGraph defines this for us
      if (msg.type === 'human') {
        role = 'user'
      } else if (msg.type === 'ai') {
        role = 'assistant'
      } else {
        // e.g. tool
        role = msg.type
      }
    }

    return { content, role }
  }
}

module.exports = LangchainRunnableSubscriber
