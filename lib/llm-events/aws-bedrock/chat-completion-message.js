/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
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
    this.setTokenCount(agent)
  }

  #setId(index) {
    const cmd = this.bedrockCommand
    if (cmd.isConverse || cmd.isTitan() === true || cmd.isClaude() === true) {
      this.id = `${this.id}-${index}`
    } else if (cmd.isCohere() === true) {
      this.id = `${this.bedrockResponse.id || this.id}-${index}`
    }
  }

  setTokenCount(agent) {
    const tokenCB = agent?.llm?.tokenCountCallback

    if (tokenCB) {
      const promptContent = this.bedrockCommand?.prompt?.map((msg) => msg.content).join(' ')
      const completionContent = this.bedrockResponse?.completions?.join(' ')

      if (promptContent && completionContent) {
        this.setTokenFromCallback(
          {
            tokenCB,
            reqModel: this.bedrockCommand.modelId,
            resModel: this.bedrockCommand.modelId,
            promptContent,
            completionContent
          }
        )
      }
      return
    }

    this.setTokenInCompletionMessage({ promptTokens: this.bedrockResponse.inputTokenCount, completionTokens: this.bedrockResponse.outputTokenCount })
  }
}

module.exports = LlmChatCompletionMessage
