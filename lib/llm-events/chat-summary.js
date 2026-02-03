/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmEvent = require('./base')

/**
 * @property {number} request.temperature Value representing how random or
 *  deterministic the output responses should be
 * @property {number} request.max_tokens Maximum number of tokens that can be
 *  generated in a chat completion
 * @property {string} request.model  Model name specified in the request (e.g. 'gpt-4')
 * @property {number} response.number_of_messages Number of messages comprising a
 *  chat completion including system, user, and assistant messages
 * @property {string} response.choices.finish_reason Reason the model stopped generating tokens (e.g. "stop")
 * @property {string} response.organization Organization ID returned in the response or response headers
 * @property {number} timestamp Timestamp captured at the time of the LLM request with millisecond precision
 */
class LlmChatCompletionSummary extends LlmEvent {
  /**
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
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
    responseOrg, temperature, maxTokens, numMsgs, finishReason, error }) {
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
}

module.exports = LlmChatCompletionSummary
