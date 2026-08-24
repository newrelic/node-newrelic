/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyConverseChunkedMessage } = require('./stringify-message')
const ModelResponse = require('./model-response')

/**
 * @typedef {object} AwsBedrockMiddlewareResponse
 * @property {object} response Has a `body` property that is an IncomingMessage,
 * a `headers` property that are the response headers, a `reason` property that
 * indicates the status code reason, and a `statusCode` property.
 * @property {object} output Has a `$metadata` property that includes the
 * `requestId`, and a `body` property that is a Uint8Array representation
 * of the response payload.
 */

/**
 * Represents a response from the Bedrock Converse API. This object
 * provides an abstraction that normalizes responses into a known
 * interface and simplifies accessing desired fields.
 */
class ConverseResponse extends ModelResponse {
  #originalResponse
  #innerOutput
  #output

  /**
   * @param {object} params params object
   * @param {AwsBedrockMiddlewareResponse} params.response AWS Bedrock middleware response
   * @param {boolean} params.isError is there an error
   */
  constructor({ response, isError = false }) {
    super({ response, isError })
    this.#originalResponse = response

    if (this.isError) {
      return
    }

    this.#innerOutput = response.output.output
    this.#output = this.#innerOutput.message
  }

  /**
   * @returns {number} The number of tokens in the prompt.
   */
  get inputTokenCount() {
    return parseInt(this.#originalResponse?.output?.usage?.inputTokens || 0, 10)
  }

  /**
   * @returns {number} The number of tokens in the completion.
   */
  get outputTokenCount() {
    return parseInt(this.#originalResponse?.output?.usage?.outputTokens || 0, 10)
  }

  /**
   * @returns {number} The total number of tokens used by the request and response.
   */
  get totalTokenCount() {
    return parseInt(this.#originalResponse?.output?.usage?.totalTokens || 0, 10)
  }

  /**
   * The prompt responses returned by the model.
   *
   * @returns {string[]} Should be an array of string responses to the prompt.
   */
  get completions() {
    const content = this.#output?.content
    if (!content) return []
    return [typeof content === 'string' ? content : stringifyConverseChunkedMessage(content)]
  }

  /**
   * The reason the model has given for finishing the response.
   *
   * @returns {string|undefined}
   */
  get finishReason() {
    if (this.isError) {
      return undefined
    }
    return this.#originalResponse.output.stopReason
  }

  /**
   * Retrieve the response identifier. For the Converse API, the requestId
   * serves as the id.
   *
   * @returns {string|undefined}
   */
  get id() {
    return this.requestId
  }
}

module.exports = ConverseResponse
