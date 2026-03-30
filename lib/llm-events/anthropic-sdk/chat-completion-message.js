/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionMessage = require('../chat-completion-message')
const getUsageTokens = require('./get-usage-tokens')

/**
 * Encapsulates an Anthropic SDK LlmChatCompletionMessage.
 */
module.exports = class AnthropicLlmChatCompletionMessage extends LlmChatCompletionMessage {
  constructor({
    agent,
    segment,
    transaction,
    request = {},
    response = {},
    sequence = 0,
    content,
    role,
    completionId,
    isResponse
  }) {
    super({
      agent,
      segment,
      transaction,
      vendor: 'anthropic',
      sequence,
      content,
      role,
      completionId,
      isResponse,
      responseModel: response?.model
    })

    this.setTokenCount(agent, request, response)
  }

  setTokenCount(agent, request, response) {
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
        this.setTokenFromCallback({
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
    this.setTokenInCompletionMessage(tokens)
  }
}
