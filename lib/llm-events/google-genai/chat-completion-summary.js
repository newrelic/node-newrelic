/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionSummary = require('../chat-completion-summary')
const { getUsageTokens } = require('./utils')

/**
 * Encapsulates a Google Gen AI LlmChatCompletionSummary.
 */
module.exports = class GoogleGenAiLlmChatCompletionSummary extends LlmChatCompletionSummary {
  constructor({ agent, segment, transaction, request, response, error }) {
    super({ agent,
      segment,
      transaction,
      responseModel: response?.modelVersion,
      requestModel: request?.model,
      finishReason: response?.candidates?.[0]?.finishReason,
      maxTokens: request.config?.maxOutputTokens,
      temperature: request.config?.temperature,
      vendor: 'gemini',
      error })

    let requestMessagesLength = 0
    if (Array.isArray(request?.contents)) {
      requestMessagesLength = request.contents.length
    } else if (typeof request?.contents === 'string') {
      requestMessagesLength = 1
    }
    this['response.number_of_messages'] = requestMessagesLength + (response?.candidates?.length || 0)

    this.setTokens(agent, request, response)
  }

  setTokens(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const promptContent = typeof request?.contents === 'string'
        ? request?.contents
        : request?.contents?.join(' ')

      const responseContent = response?.candidates?.[0]?.content?.parts
      const completionContent = responseContent?.map((content) => content.text).join(' ')

      if (promptContent && completionContent) {
        this.setTokenUsageFromCallback(
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
    this.setTokensInResponse(tokens)
  }
}
