/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionMessage = require('../chat-completion-message')
const getUsageTokens = require('./get-usage-tokens')

/**
 * @augments LlmChatCompletionMessage
 * Encapsulates an OpenAI `LlmChatCompletionMessage` event.
 */
module.exports = class OpenAiLlmChatCompletionMessage extends LlmChatCompletionMessage {
  constructor({ agent,
    segment,
    transaction,
    request,
    response,
    sequence = 0,
    message = { content: undefined, role: undefined },
    isResponse,
    completionId, }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'openai',
      requestId: response?.headers?.['x-request-id'],
      responseId: response?.id,
      responseModel: response?.model,
      sequence,
      content: message?.content,
      role: message?.role,
      completionId,
      isResponse })

    this.setTokenCount(agent, request, response)
  }

  setTokenCount(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (tokenCB) {
      const messages = request?.input || request?.messages

      const promptContent = typeof messages === 'string'
        ? messages
        : messages?.map((msg) => msg.content).join(' ')

      const completionContent = response?.output
        ? response.output.map((resContent) => resContent.content[0].text).join(' ')
        : response?.choices?.map((resContent) => resContent.message.content).join(' ')

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
