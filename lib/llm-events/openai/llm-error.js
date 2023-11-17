/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error returned from the OpenAI API.
 */
class OpenAiLlmError extends Error {
  /**
   * @param {object} params
   * @param {Error} params.cause The OpenAI error object. It has some extra
   * properties, but is a direct descendent of Error.
   * @param {LlmChatCompletionSummary} [params.summary] Details about the
   * conversation.
   * @param {LlmEmbedding} [params.embedding]
   */
  constructor({ cause, summary, embedding }) {
    super(cause.message, { cause: cause.error })
    this.http = {
      statusCode: cause.status
    }
    this.error = {
      code: cause.error.code,
      param: cause.error.param
    }
    // this.statusCode = cause.status
    // this.code = cause.error.code
    // this.param = cause.error.param
    this.completion_id = summary?.id
    this.embedding_id = embedding?.id
  }
}

module.exports = OpenAiLlmError
