/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { makeId } = require('../../util/hashes')

module.exports = class LlmChatCompletionMessage extends LlmEvent {
  constructor({
    agent,
    segment,
    request = {},
    response = {},
    index = 0,
    message,
    completionId,
    transaction
  }) {
    super({ agent, segment, request, response, transaction })
    this.id = makeId(36)
    // message?.role is only defined if the message is
    // a response and it is always 'model'.
    // request messages do not have a role
    this.role = message?.role ?? 'user'
    this.sequence = index
    this.completion_id = completionId
    const responseText = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text
    this.is_response = responseText === message?.parts?.[0]?.text

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = this.is_response ? message?.parts?.[0]?.text : message
    }

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

    const tokens = this.getUsageTokens(response)
    this.setTokenInCompletionMessage(tokens)
  }
}
