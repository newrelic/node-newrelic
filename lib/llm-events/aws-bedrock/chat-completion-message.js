/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
const { setTokenFromCallback } = require('../utils')
const { tokenUsageAttributesExist, tokenUsageHeadersExist } = require('./utils')

/**
 * @typedef {object} LlmChatCompletionParams
 * @augments LlmEventParams
 * @property {string} completionId An identifier for the completion message.
 * @property {string} content The human readable response from the LLM.
 * @property {number} [index=0] The order of the message in the conversation.
 * @property {boolean} [isResponse=false] Indicates if the message represents
 * a response from the LLM.
 * @property {object} message The message sent to the LLM.
 * @property {OutgoingMessage} request The outgoing HTTP request used in the
 * LLM conversation.
 */
/**
 * @type {LlmChatCompletionParams}
 */
const defaultParams = {
  completionId: '',
  content: '',
  index: 0,
  isResponse: false,
  message: {},
  request: {}
}

/**
 * Represents an LLM chat completion.
 */
class LlmChatCompletionMessage extends LlmEvent {
  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    super(params)

    const { agent, content, isResponse, index, completionId, role } = params
    const recordContent = agent.config?.ai_monitoring?.record_content?.enabled

    this.is_response = isResponse
    this.completion_id = completionId
    this.sequence = index
    this.content = recordContent === true ? content : undefined
    this.role = role

    this.#setId(index)
    this.setTokenCount(agent, this.bedrockCommand, this.bedrockResponse)
  }

  #setId(index) {
    const cmd = this.bedrockCommand
    if (cmd.isConverse || cmd.isTitan() === true || cmd.isClaude() === true) {
      this.id = `${this.id}-${index}`
    } else if (cmd.isCohere() === true) {
      this.id = `${this.bedrockResponse.id || this.id}-${index}`
    }
  }

  setTokenCount(agent, command, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (tokenCB) {
      const promptContent = command.prompt?.[0]?.content
      const completionContent = response.completions?.[0]

      setTokenFromCallback(
        {
          context: this,
          tokenCB,
          reqModel: command.modalId,
          resModel: command.modelId,
          promptContent,
          completionContent
        }
      )
      return
    }

    // If no token count callback is available, we need to check the response object
    // or response headers for usage information and set token_count to 0 if all usage attributes are present.
    if (tokenUsageAttributesExist(response) || tokenUsageHeadersExist(response)) {
      this.token_count = 0
    }
  }
}

module.exports = LlmChatCompletionMessage
