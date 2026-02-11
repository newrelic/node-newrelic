/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionSummary = require('../chat-completion-summary')
const getUsageTokens = require('./get-usage-tokens')

/**
 * @augments LlmChatCompletionSummary
 * Encapsulates an OpenAI `LlmChatCompletionSummary` event.
 */
module.exports = class OpenAiLlmChatCompletionSummary extends LlmChatCompletionSummary {
  /**
   * @param {object} params Constructor parameters.
   * @param {Agent} params.agent New Relic agent instance.
   * @param {TraceSegment} params.segment Current segment.
   * @param {Transaction} params.transaction Current and active transaction.
   * @param {object} params.request OpenAI request object.
   * @param {object} params.response OpenAI response object.
   * @param {boolean} [params.error] Set to `true` if an error occurred, can be omitted in false cases.
   */
  constructor({ agent, segment, transaction, request, response, error }) {
    super({
      agent,
      segment,
      transaction,
      vendor: 'openai',
      error,
      responseModel: response?.model,
      responseOrg: response?.headers?.['openai-organization'],
      requestModel: request?.model,
      requestId: response?.headers?.['x-request-id'],
      temperature: request?.temperature,
      maxTokens: request?.max_tokens ?? request?.max_output_tokens
    })

    if (request?.input) {
      // `responses.create` api logic
      // `request.input` can be an array or a string.
      const requestLength = Array.isArray(request.input) ? request.input.length : 1
      this['response.number_of_messages'] = requestLength + (response?.output?.length ?? 0)
      this['response.choices.finish_reason'] = response?.status
    } else {
      // `chat.completions.create` api logic
      this['response.number_of_messages'] = request?.messages?.length + response?.choices?.length
      this['response.choices.finish_reason'] = response?.choices?.[0]?.finish_reason
    }

    this.setTokens(agent, request, response)
    if (response.headers) {
      // Set response.headers.*
      this['response.headers.llmVersion'] = response.headers['openai-version']
      this['response.headers.ratelimitLimitRequests'] = response.headers['x-ratelimit-limit-requests']
      this['response.headers.ratelimitLimitTokens'] = response.headers['x-ratelimit-limit-tokens']
      this['response.headers.ratelimitResetTokens'] = response.headers['x-ratelimit-reset-tokens']
      this['response.headers.ratelimitRemainingTokens'] = response.headers['x-ratelimit-remaining-tokens']
      this['response.headers.ratelimitRemainingRequests'] = response.headers['x-ratelimit-remaining-requests']
    }
  }

  setTokens(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const messages = request?.input || request?.messages

      const promptContent = typeof messages === 'string'
        ? messages
        : messages?.map((msg) => msg.content).join(' ')

      const completionContent = response?.output
        ? response.output.map((resContent) => resContent.content[0].text).join(' ')
        : response?.choices?.map((resContent) => resContent.message.content).join(' ')

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
