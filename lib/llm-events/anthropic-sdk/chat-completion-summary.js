/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionSummary = require('../chat-completion-summary')
const getUsageTokens = require('./get-usage-tokens')

/**
 * Encapsulates an Anthropic SDK LlmChatCompletionSummary.
 */
module.exports = class AnthropicLlmChatCompletionSummary extends LlmChatCompletionSummary {
  /**
   * @param {object} params Constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {TraceSegment} params.segment Current segment
   * @param {Transaction} params.transaction Current and active transaction
   * @param {object} params.request Anthropic SDK request object
   * @param {object} params.response Anthropic SDK response object
   * @param {number} [params.timeOfFirstToken] Timestamp of when the first token was sent, for streaming only.
   * @param {boolean} [params.error] Set to `true` if an error occurred
   */
  constructor({ agent, segment, transaction, request, response, timeOfFirstToken, error }) {
    super({
      agent,
      segment,
      transaction,
      responseModel: response?.model,
      requestModel: request?.model,
      finishReason: response?.stop_reason,
      maxTokens: request?.max_tokens,
      temperature: request?.temperature,
      vendor: 'anthropic',
      timeOfFirstToken,
      error
    })

    let requestMessagesLength = 0
    if (Array.isArray(request?.messages)) {
      requestMessagesLength = request.messages.length
    }
    // Response is always a single message from the assistant
    const responseMessageCount = response?.content ? 1 : 0
    this['response.number_of_messages'] = requestMessagesLength + responseMessageCount

    this.setTokens(agent, request, response)
  }

  setTokens(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (tokenCB) {
      const promptContent = request?.messages
        ?.map((msg) => {
          if (typeof msg.content === 'string') return msg.content
          if (Array.isArray(msg.content)) {
            return msg.content
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join(' ')
          }
          return ''
        })
        .join(' ')

      const completionContent = response?.content
        ?.filter((block) => block.type === 'text')
        ?.map((block) => block.text)
        ?.join(' ')

      if (promptContent && completionContent) {
        this.setTokenUsageFromCallback({
          tokenCB,
          reqModel: request.model,
          resModel: this['response.model'],
          promptContent,
          completionContent
        })
      }
      return
    }

    const tokens = getUsageTokens(response)
    this.setTokensInResponse(tokens)
  }
}
