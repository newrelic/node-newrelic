/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { setUsageTokens } = require('./utils')
const { setTokenUsageFromCallback } = require('../utils')

module.exports = class LlmChatCompletionSummary extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false, transaction }) {
    super({ agent, segment, request, response, responseAttrs: true, transaction })
    this.error = withError
    this['request.max_tokens'] = request.max_tokens ?? request.max_output_tokens
    this['request.temperature'] = request.temperature

    if (request?.input) {
      // `responses.create` logic
      // `request.input` can be an array or a string.
      const requestLength = Array.isArray(request?.input) ? request.input.length : 1
      this['response.number_of_messages'] = requestLength + (response?.output?.length ?? 0)
      this['response.choices.finish_reason'] = response?.status
    } else {
      // `chat.completions.create` logic
      this['response.number_of_messages'] = request?.messages?.length + response?.choices?.length
      this['response.choices.finish_reason'] = response?.choices?.[0]?.finish_reason
    }

    this.setTokens(agent, request, response)
  }

  setTokens(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const messages = request?.input || request?.messages
      const promptContent = messages.map((msg) => msg.content).join(' ')

      let completionContent
      if (response?.output) {
        completionContent = response.output.map((resContent) => resContent.content[0].text).join(' ')
      } else {
        completionContent = response.choices.map((resContent) => resContent.message.content).join(' ')
      }

      setTokenUsageFromCallback(
        {
          context: this,
          tokenCB,
          reqModel: request.model,
          resModel: this['response.model'],
          promptContent,
          completionContent
        }
      )
      return
    }
    setUsageTokens(response, this)
  }
}
