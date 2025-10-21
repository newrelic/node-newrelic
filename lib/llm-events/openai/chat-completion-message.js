/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { tokenUsageAttributesExist } = require('./utils')
const { setTokenFromCallback } = require('../utils')

module.exports = class LlmChatCompletionMessage extends LlmEvent {
  constructor({
    agent,
    segment,
    request = {},
    response = {},
    index = 0,
    message = { content: undefined, role: undefined },
    completionId,
    transaction
  }) {
    super({ agent, segment, request, response, transaction })
    this.id = `${response.id}-${index}`
    this.role = message?.role
    this.sequence = index
    this.completion_id = completionId

    // Check if the given message is from the response.
    // The response object differs based on the API called.
    // If it's `responses.create`, we check against `response.output`.
    // If it's `chat.completions.create` or langchain, we check against `response.choices`.
    if (response?.object === 'response') {
      this.is_response = message.content === response?.output?.[0]?.content?.[0]?.text
    } else {
      this.is_response = message.content === response?.choices?.[0]?.message?.content
    }

    // Assign content to the event.
    const content = message?.content
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = content
    }
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
        setTokenFromCallback(
          {
            context: this,
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

    // If no token count callback is available, we need to check the response object
    // for usage information and set token_count to 0 if all usage attributes are present.
    if (tokenUsageAttributesExist(response)) {
      this.token_count = 0
    }
  }
}
