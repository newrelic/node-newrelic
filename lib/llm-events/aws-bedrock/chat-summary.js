/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmChatCompletionSummary = require('../chat-summary')

module.exports = class AwsBedrockLlmChatCompletionSummary extends LlmChatCompletionSummary {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {object} params.bedrockCommand AWS Bedrock Command object, represents the request
   * @param {object} params.bedrockResponse AWS Bedrock Response object
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, bedrockCommand, bedrockResponse, error }) {
    super({ agent,
      segment,
      transaction,
      error,
      vendor: 'bedrock',
      requestModel: bedrockCommand?.modelId,
      requestId: bedrockResponse?.requestId,
      responseModel: bedrockCommand?.modelId, // we can assume requestModel==responseModel in bedrock
      temperature: bedrockCommand.temperature,
      maxTokens: bedrockCommand.maxTokens,
      numMsgs: (bedrockCommand.prompt.length ?? 0) + (bedrockResponse.completions.length ?? 0),
      finishReason: bedrockResponse?.finishReason })

    this.appName = agent.config.applications()[0] // TODO: still required?
    this.setTokens(agent, bedrockCommand, bedrockResponse)
  }

  setTokens(agent, bedrockCommand, bedrockResponse) {
    const tokenCB = agent?.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const promptContent = bedrockCommand?.prompt?.map((msg) => msg.content).join(' ')
      const completionContent = bedrockResponse?.completions?.join(' ')

      this.setTokenUsageFromCallback(
        {
          tokenCB,
          reqModel: bedrockCommand.modelId,
          resModel: bedrockCommand.modelId,
          promptContent,
          completionContent
        }
      )
      return
    }

    this.setTokensInResponse({ promptTokens: bedrockResponse.inputTokenCount,
      completionTokens: bedrockResponse.outputTokenCount,
      totalTokens: bedrockResponse.totalTokenCount })
  }
}
