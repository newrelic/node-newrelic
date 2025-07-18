/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error returned from LLM operations.
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
   * @param {LlmVectorStoreSearch} [params.vectorsearch] Details about the vector
   * search if it was a vector search event.
   * @param {LlmTool} [params.tool] Details about the tool event if it was a tool event.
   */
  constructor({ response, cause, summary, embedding, vectorsearch, tool } = {}) {
    // For @google/genai only, cause does not have the `error` or `status` fields,
    // but it does have `message` with the info we need. So, we need to parse
    // the relevant fields from cause.message to get `status` and `error`.
    let parsedError
    const isGeminiVendor = embedding?.vendor === 'gemini' || summary?.vendor === 'gemini'
    if (isGeminiVendor && cause?.message) {
      try {
        // Extract the JSON portion of the cause.message
        const jsonStartIndex = cause.message.indexOf('{')
        const jsonString = cause.message.substring(jsonStartIndex)
        parsedError = JSON.parse(jsonString)?.error
      } catch {
        parsedError = undefined
      }
    }
    this['http.statusCode'] = response?.status ?? cause?.status ?? parsedError?.code
    this['error.message'] = cause?.message
    this['error.code'] = response?.code ?? cause?.error?.code ?? parsedError?.code
    this['error.param'] = response?.param ?? cause?.error?.param
    this.completion_id = summary?.id
    this.embedding_id = embedding?.id
    this.vector_store_id = vectorsearch?.id
    this.tool_id = tool?.id
  }

  get [Symbol.toStringTag]() {
    return 'LlmErrorMessage'
  }
}
