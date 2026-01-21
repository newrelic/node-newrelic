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

  getMessages({ request, response }) {
    // Only take the first response message and append to input messages
    // request.contents can be a string or an array of strings
    // response.candidates is an array of candidates (choices); we only take the first one
    const inputMessages = Array.isArray(request.contents) ? request.contents : [request.contents]
    const responseMessage = response?.candidates?.[0]?.content
    return responseMessage !== undefined ? [...inputMessages, responseMessage] : inputMessages
  }

  createCompletionSummary({ ctx, request, response = {}, err }) {
    const { transaction, segment } = ctx
    return new LlmChatCompletionSummary({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      withError: !!err
    })
  }

  createCompletionMessage({ ctx, request, response, index, completionId, message }) {
    const { segment, transaction } = ctx
    return new LlmChatCompletionMessage({
      agent: this.agent,
      segment,
      transaction,
      request,
      response,
      index,
      completionId,
      message
    })
  }
}

module.exports = GoogleGenAIGenerateContentSubscriber
