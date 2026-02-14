/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionMessage = require('../chat-completion-message')
const getUsageTokens = require('./get-usage-tokens')

/**
 * Encapsulates a Google Gen AI LlmChatCompletionMessage.
 */
module.exports = class GoogleGenAiLlmChatCompletionMessage extends LlmChatCompletionMessage {
  constructor({ agent,
    segment,
    transaction,
    request = {},
    response = {},
    sequence = 0,
    content, role,
    completionId,
    isResponse }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'gemini',
      sequence,
      content,
      role,
      completionId,
      isResponse,
      responseModel: response?.modelVersion })

    this.setTokenCount(agent, request, response)
  }

  setTokenCount(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (tokenCB) {
      const promptContent = typeof request?.contents === 'string'
        ? request?.contents
        : request?.contents?.join(' ')

      const responseContent = response?.candidates?.[0]?.content?.parts
      const completionContent = responseContent?.map((content) => content.text).join(' ')

      if (promptContent && completionContent) {
        this.setTokenFromCallback(
          {
            tokenCB,
            reqModel: request.model,
            resModel: this['response.model'],
            promptContent,
            completionContent
          }
        )
      }
      return
    }

    const tokens = getUsageTokens(response)
    this.setTokenInCompletionMessage(tokens)
  }
}
