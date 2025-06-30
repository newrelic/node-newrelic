/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyConverseChunkedMessage } = require('./utils')

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
 * Represents a response from the Bedrock API. Given that the API response
 * has as many different shapes as the number of models it supports, and the
 * fact that responses require byte array processing, this object provides
 * an abstraction that normalizes responses into a known interface and
 * simplifies accessing desired fields.
 */
class BedrockConverseResponse {
  #innerResponse
  #innerOutput
  #output
  #command
  #completions = []
  #id

  /**
   * @param {object} params
   * @param {AwsBedrockMiddlewareResponse} params.response
   * @param {BedrockCommand} params.bedrockCommand
   * @param params.isError
   */
  constructor({ response, bedrockCommand, isError = false }) {
    this.#innerResponse = isError ? response.$response : response.response
    this.#command = bedrockCommand
    this.isError = isError

    if (this.isError) {
      return
    }

    this.#innerOutput = response.output.output

    this.#output = this.#innerOutput.message
  }

  /**
   * The prompt responses returned by the model.
   *
   * @returns {string[]|*[]} Should be an array of string responses to the
   * prompt.
   */
  get completions() {
    return [
      typeof this.#output.content === 'string'
        ? this.#output.content
        : stringifyConverseChunkedMessage(this.#output.content)
    ]
  }

  /**
   * The reason the model has given for finishing the response.
   *
   * @returns {string|*}
   */
  get finishReason() {
    if (this.isError) {
      return undefined
    }

    return this.#innerOutput.stopReason
  }

  /**
   * HTTP headers provided in the API response.
   *
   * @returns {object} Typical key-value set of HTTP headers.
   */
  get headers() {
    return this.#innerResponse.headers
  }

  /**
   * Retrieve the response identifier provided by some model responses.
   *
   * @returns {string|undefined}
   */
  get id() {
    return this.requestId
  }

  /**
   * UUID assigned to the initial request as returned by the API.
   *
   * @returns {string}
   */
  get requestId() {
    return this.headers?.['x-amzn-requestid']
  }

  /**
   * The HTTP status code of the response.
   *
   * @returns {number}
   */
  get statusCode() {
    return this.#innerResponse.statusCode
  }
}

module.exports = BedrockConverseResponse
