/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Base class for AWS Bedrock response wrappers (`InvokeModelResponse`, `ConverseResponse`).
 */
class ModelResponse {
  #innerResponse

  /**
   * @param {object} params params object
   * @param {object} params.response AWS Bedrock middleware response
   * @param {boolean} [params.isError] is there an error
   */
  constructor({ response, isError = false }) {
    this.#innerResponse = isError ? response.$response : response.response
    this.isError = isError
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

module.exports = ModelResponse
