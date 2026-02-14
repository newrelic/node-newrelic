/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const { AiMonitoringChatSubscriber } = require('../ai-monitoring')
const { AI } = require('../../metrics/names')
const { GEMINI } = AI
const { LlmChatCompletionSummary, LlmChatCompletionMessage } = require('#agentlib/llm-events/google-genai/index.js')

class GoogleGenAIGenerateContentSubscriber extends AiMonitoringChatSubscriber {
  constructor({ agent, logger, channelName = 'nr_generateContentInternal' }) {
    super({ agent, logger, channelName, packageName: '@google/genai', name: GEMINI.COMPLETION, trackingPrefix: GEMINI.TRACKING_PREFIX })
    this.events = ['asyncEnd']
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const { result: response, arguments: args, error: err } = data
    const [request] = args

    this.recordChatCompletionEvents({
      ctx,
      request,
      response,
      err
    })
  }

  /**
   * Gets the request/input and response messages from the
   * Google Gen AI request and response objects.
   * @param {object} params function parameters
   * @param {object} params.request Google Gen AI request object
   * @param {object} params.response Google Gen AI response object
   * @returns {object[]} an array of messages like { content, role }
   */
  getMessages({ request, response }) {
    // request.contents can be a string or an array of strings
    const contents = Array.isArray(request.contents) ? request.contents : [request.contents]
    const messages = contents.map((item) => {
      return { content: item, role: 'user' }
    })
    const responseContent = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text
    if (responseContent) {
      // Do not push an empty response (likely from an error)
      messages.push({ content: responseContent, role: 'assistant' })
    }
    return messages
  }

  createCompletionSummary({ ctx, request, response = {}, err }) {
    const { transaction, segment } = ctx
    return new LlmChatCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      error: !!err
    })
  }

  createCompletionMessage({ ctx, request, response, index, completionId, message }) {
    const { segment, transaction } = ctx

    const isResponse = message?.content === response?.text

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

module.exports = GoogleGenAIGenerateContentSubscriber
