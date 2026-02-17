/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionMessage = require('../chat-completion-message')

module.exports = class AwsBedrockLlmChatCompletionMessage extends LlmChatCompletionMessage {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {object} params.bedrockCommand AWS Bedrock Command object, represents the request
   * @param {object} params.bedrockResponse AWS Bedrock Response object
   * @param {string} params.content Content of the message
   * @param {string} [params.role] Role of the message creator (e.g. `user`, `assistant`, `tool`)
   * @param {string} params.completionId ID of the `LlmChatCompletionSummary` event that
   *    this message event is connected to
   * @param {number} params.sequence Index (beginning at 0) associated with
   *    each message including the prompt and responses
   * @param {boolean} [params.isResponse] Indiciates if this message is the response
   */
  constructor({ agent, segment, transaction, bedrockCommand, bedrockResponse, content, role, completionId, sequence = 0, isResponse }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'bedrock',
      content,
      role,
      sequence,
      requestId: bedrockResponse?.requestId,
      responseId: bedrockResponse?.id,
      responseModel: bedrockCommand?.modelId, // we can assume requestModel==responseModel in bedrock
      completionId,
      isResponse })

    this.setTokenCount(agent, bedrockCommand, bedrockResponse)
  }

  setTokenCount(agent, bedrockCommand, bedrockResponse) {
    const tokenCB = agent?.llm?.tokenCountCallback

    if (tokenCB) {
      const promptContent = bedrockCommand?.prompt?.map((msg) => msg.content).join(' ')
      const completionContent = bedrockResponse?.completions?.join(' ')

      if (promptContent && completionContent) {
        this.setTokenFromCallback(
          {
            tokenCB,
            reqModel: bedrockCommand.modelId,
            resModel: bedrockCommand.modelId,
            promptContent,
            completionContent
          }
        )
      }
      return
    }

    this.setTokenInCompletionMessage({ promptTokens: bedrockResponse.inputTokenCount,
      completionTokens: bedrockResponse.outputTokenCount })
  }
}
