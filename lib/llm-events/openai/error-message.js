/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error returned from the OpenAI API.
 */
module.exports = class LlmErrorMessage {
  /**
   * @param {object} params Constructor parameters
   * @param {object} [params.response] Instance of an incoming message.
   * @param {object} [params.cause] An instance of the OpenAI error object.
   * @param {LlmChatCompletionSummary} [params.summary] Details about the
   * conversation if it was a chat completion conversation.
   * @param {LlmEmbedding} [params.embedding] Details about the conversation
   * if it was an embedding conversation.
   */
  constructor({ response, cause, summary, embedding } = {}) {
    this['http.statusCode'] = response?.status ?? cause?.status
    this['error.message'] = cause?.message
    this['error.code'] = response?.code ?? cause?.error?.code
    this['error.param'] = response?.param ?? cause?.error?.param
    this.completion_id = summary?.id
    this.embedding_id = embedding?.id
  }
}
