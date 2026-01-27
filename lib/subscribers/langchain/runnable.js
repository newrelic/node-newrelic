/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI: { LANGCHAIN } } = require('../../metrics/names')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
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
    // Requests via LangGraph API have the `messages` property with the
    // information we need, otherwise it just lives on the `request`
    // object directly.
    const userRequest = request?.messages ? request.messages?.[0] : request
    const params = data?.arguments?.[1] || {}
    const { result: response, error: err } = data
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
    return new LangChainCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      error: !!err,
      messages,
      metadata,
      tags,
      runId: segment[langchainRunId]
    })
  }

  getMessages({ request, response }) {
    const messages = []
    // check if request is truthy and an empty string
    if (request || request === '') {
      messages.push(request)
    }

    // check if response is truthy and an empty string
    if (response || response === '') {
      messages.push(response)
    }

    return messages
  }

  createCompletionMessage({ ctx, response, index, completionId, message }) {
    const { segment, transaction } = ctx
    // check before grabbing a key from it in the AiMessageChunk case
    const isResponse = message === response
    const { content, role } = this.extractContentAndRole(message)

    return new LangChainCompletionMessage({
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
    if (msg?.messages) {
      // Typical structure for LangGraph
      msg = msg.messages[0]
    }

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
