/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

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
class BedrockResponse {
  #innerResponse
  #innerOutput
  #parsedBody
  #command
  #completions = []
  #id

  /* eslint-disable sonarjs/cognitive-complexity */
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

    this.#innerOutput = response.output

    const json = new TextDecoder().decode(this.#innerOutput.body)
    this.#parsedBody = JSON.parse(json)

    const cmd = this.#command
    const body = this.#parsedBody
    if (cmd.isAi21() === true) {
      this.#completions = body.completions?.map((c) => c.data.text) ?? []
      this.#id = body.id
    } else if (cmd.isClaude() === true) {
      // TODO: can we make this thing give more than one completion?
      body.completion && this.#completions.push(body.completion)
    } else if (cmd.isClaude3() === true) {
      if (body?.type === 'message_stop') {
        // Streamed response
        this.#completions = body.completions
      } else {
        this.#completions = body?.content?.map((c) => c.text)
      }
      this.#id = body.id
    } else if (cmd.isCohere() === true) {
      this.#completions = body.generations?.map((g) => g.text) ?? []
      this.#id = body.id
    } else if (cmd.isLlama() === true) {
      body.generation && this.#completions.push(body.generation)
    } else if (cmd.isTitan() === true) {
      this.#completions = body.results?.map((r) => r.outputText) ?? []
    }
  }
  /* eslint-enable sonarjs/cognitive-complexity */

  /**
   * The prompt responses returned by the model.
   *
   * @returns {string[]|*[]} Should be an array of string responses to the
   * prompt.
   */
  get completions() {
    return this.#completions
  }

  /**
   * The reason the model has given for finishing the response.
   *
   * @returns {string|*}
   */
  get finishReason() {
    let result

    if (this.isError) {
      return result
    }

    const cmd = this.#command
    if (cmd.isAi21() === true) {
      result = this.#parsedBody.completions?.[0]?.finishReason.reason
    } else if (cmd.isClaude() === true || cmd.isClaude3() === true) {
      result = this.#parsedBody.stop_reason
    } else if (cmd.isCohere() === true) {
      result = this.#parsedBody.generations?.find((r) => r.finish_reason !== null)?.finish_reason
    } else if (cmd.isLlama() === true) {
      result = this.#parsedBody.stop_reason
    } else if (cmd.isTitan() === true) {
      result = this.#parsedBody.results?.find((r) => r.completionReason !== null)?.completionReason
    }
    return result
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
    return this.#id
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

  #tokenCount(headerName) {
    const headerVal = this.headers?.[headerName]
    if (headerVal != null) {
      return parseInt(headerVal, 10)
    }
    return undefined
  }
}

module.exports = BedrockResponse
