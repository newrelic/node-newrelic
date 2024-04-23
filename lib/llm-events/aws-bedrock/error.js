/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error returned from AWS Bedrock.
 */
module.exports = class LlmError {
  /**
   * @param {object} params Constructor parameters
   * @param {BedrockResponse} [params.bedrockResponse] Instance of an incoming message.
   * @param {object} [params.err] AWS error object
   * @param {LlmChatCompletionSummary} [params.summary] Details about the
   * conversation if it was a chat completion conversation.
   * @param {LlmEmbedding} [params.embedding] Details about the conversation
   * if it was an embedding conversation.
   */
  constructor({ bedrockResponse = {}, err = {}, summary = {}, embedding = {} } = {}) {
    this['http.statusCode'] = bedrockResponse.statusCode
    this['error.message'] = err.message
    this['error.code'] = err.name
    this.completion_id = summary.id
    this.embedding_id = embedding.id
  }
}
