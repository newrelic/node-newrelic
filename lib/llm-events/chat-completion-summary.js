/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event-base')

/**
 * An event that captures high-level data about the creation of a
 * chat completion including request, response, and call information.
 *
 * @augments LlmEvent
 * @property {number} duration Total time taken for the chat completion to
 *  complete in milliseconds
 * @property {number} timestamp Timestamp captured at the time of the LLM
 *  request with millisecond precision
 * @property {number} request.max_tokens Maximum number of tokens that can be
 *  generated in a chat completion
 * @property {string} request.model  Model name specified in the request
 *  (e.g. 'gpt-4')
 * @property {number} request.temperature Value representing how random or
 *  deterministic the output responses should be
 * @property {string} response.choices.finish_reason Reason the model stopped
 *  generating tokens (e.g. "stop")
 * @property {number} response.number_of_messages Number of messages comprising
 *  a chat completion including system, user, and assistant messages
 * @property {string} response.organization Organization ID returned in the
 *  response or response headers
 */
module.exports = class LlmChatCompletionSummary extends LlmEvent {
  /**
   * @param {object} params Constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {TraceSegment} params.segment Current segment
   * @param {Transaction} params.transaction Current and active transaction
   * @param {string} params.vendor Lowercase vendor name, e.g. "openai"
   * @param {string} params.responseModel Model name from response
   * @param {string} params.requestModel  Model name specified in the request (e.g. 'gpt-4')
   * @param {string} params.requestId ID from request/response headers
   * @param {string} params.responseOrg Organization ID returned in the response or response headers
   * @param {number} params.temperature Value representing how random or
   *  deterministic the output responses should be
   * @param {number} params.maxTokens Maximum number of tokens that can be
   *  generated in a chat completion
   * @param {number} params.numMsgs Number of messages comprising a
   *  chat completion including system, user, and assistant messages
   * @param {string} params.finishReason Reason the model stopped generating tokens (e.g. "stop")
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, vendor, responseModel, requestModel, requestId,
    responseOrg, temperature, maxTokens, numMsgs = 0, finishReason, error }) {
    super({ agent, segment, transaction, vendor, responseModel, requestId, error })

    if (requestModel) this['request.model'] = requestModel
    if (maxTokens) this['request.max_tokens'] = maxTokens
    if (temperature) this['request.temperature'] = temperature
    if (finishReason) this['response.choices.finish_reason'] = finishReason
    if (responseOrg) this['response.organization'] = responseOrg

    this['response.number_of_messages'] = numMsgs
    this.timestamp = segment.timer.start
    this.duration = segment.getDurationInMillis()
  }

  /**
   * Calculates the total token count from the prompt tokens and completion tokens
   * set in the event.
   * @returns {number} The total token count
   */
  get totalTokenCount() {
    return Number(this['response.usage.prompt_tokens']) + Number(this['response.usage.completion_tokens'])
  }

  /**
   * Sets the provided tokens counts on the LLM event.
   * Checks if `promptTokens` and `completionTokens` are greater than zero before setting.
   * This is because the spec states that token counts should only be set if both
   * are present.
   * @param {object} params to the function
   * @param {object} params.promptTokens value of prompt token count
   * @param {object} params.completionTokens value of completion(s) token count
   * @param {object} params.totalTokens value of prompt + completion(s) token count
   */
  setTokensInResponse({ promptTokens, completionTokens, totalTokens }) {
    if (this.isValidTokenCount(promptTokens) && this.isValidTokenCount(completionTokens)) {
      this['response.usage.prompt_tokens'] = promptTokens
      this['response.usage.completion_tokens'] = completionTokens
      this['response.usage.total_tokens'] = totalTokens || this.totalTokenCount
    }
  }

  /**
   * Calculates prompt and completion token counts using the provided callback and models.
   * If both counts are valid, sets token prompt, completion and total counts on the event.
   *
   * @param {object} options - The params object.
   * @param {Function} options.tokenCB - The token counting callback function.
   * @param {string} options.reqModel - The model used for the prompt.
   * @param {string} options.resModel - The model used for the completion.
   * @param {string} options.promptContent - The prompt content to count tokens for.
   * @param {string} options.completionContent - The completion content to count tokens for.
   * @returns {void}
   */
  setTokenUsageFromCallback({ tokenCB, reqModel, resModel, promptContent, completionContent }) {
    const promptTokens = this.calculateCallbackTokens(tokenCB, reqModel, promptContent)
    const completionTokens = this.calculateCallbackTokens(tokenCB, resModel, completionContent)
    this.setTokensInResponse({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens })
  }
}
