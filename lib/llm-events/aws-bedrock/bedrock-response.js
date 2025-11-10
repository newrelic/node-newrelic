/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyClaudeChunkedMessage, stringifyConverseChunkedMessage } = require('./utils')

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
 * Represents a response from the Bedrock API, handling both standard and Converse API responses.
 * This object provides an abstraction that normalizes responses into a known interface and
 * simplifies accessing desired fields, accommodating the varied shapes of Bedrock API responses.
 */
class BedrockResponse {
  #originalResponse
  #innerResponse
  #innerOutput
  #parsedBody
  #output
  #command
  #completions = []
  #id
  #isConverse

  /**
   * @param {object} params params object
   * @param {AwsBedrockMiddlewareResponse} params.response AWS Bedrock middleware response
   * @param {BedrockCommand} params.bedrockCommand AWS Bedrock command
   * @param {boolean} params.isError is there an error
   */
  constructor({ response, bedrockCommand, isError = false }) {
    this.#originalResponse = response
    this.#innerResponse = isError ? response.$response : response.response
    this.#command = bedrockCommand
    this.isError = isError
    this.#isConverse = this.#command.isConverse ?? false

    if (this.isError) {
      return
    }

    if (this.#isConverse) {
      this.#innerOutput = response.output.output
      this.#output = this.#innerOutput.message
    } else {
      this.#innerOutput = response.output
      const json = new TextDecoder().decode(this.#innerOutput.body)
      this.#parsedBody = JSON.parse(json)

      const cmd = this.#command
      const body = this.#parsedBody
      this.#extractCompletionsAndId(cmd, body)
    }
  }

  /**
   * The parsed body of the response.
   *
   * @returns {object|undefined}
   */
  get parsedBody() {
    return this.#parsedBody
  }

  get inputTokenCount() {
    if (this.#isConverse) {
      return parseInt(this.#originalResponse?.output?.usage?.inputTokens || 0, 10)
    }

    return parseInt(this?.headers?.['x-amzn-bedrock-input-token-count'] || 0, 10)
  }

  get outputTokenCount() {
    if (this.#isConverse) {
      return parseInt(this.#originalResponse?.output?.usage?.outputTokens || 0, 10)
    }

    return parseInt(this?.headers?.['x-amzn-bedrock-output-token-count'] || 0, 10)
  }

  get totalTokenCount() {
    if (this.#isConverse) {
      return parseInt(this.#originalResponse?.output?.usage?.totalTokens || 0, 10)
    }

    return this.inputTokenCount + this.outputTokenCount
  }

  /**
   * The prompt responses returned by the model.
   *
   * @returns {string[]|*[]} Should be an array of string responses to the
   * prompt.
   */
  get completions() {
    if (this.#isConverse === false) {
      return this.#completions
    }
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
    if (this.#isConverse) {
      return this.#originalResponse.output.stopReason
    }
    const cmd = this.#command
    if (cmd.isClaude() === true || cmd.isClaude3() === true) {
      return this.#parsedBody.stop_reason
    }
    if (cmd.isCohere() === true) {
      return this.#parsedBody.generations?.find((r) => r.finish_reason !== null)?.finish_reason
    }
    if (cmd.isLlama() === true) {
      return this.#parsedBody.stop_reason
    }
    if (cmd.isTitan() === true) {
      return this.#parsedBody.results?.find((r) => r.completionReason !== null)?.completionReason
    }
    return undefined
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
    // For Converse API, the requestId serves as the id.
    return this.#isConverse ? this.requestId : this.#id
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

  /**
   * Extracts and sets #completions and #id from the InvokeModel response body.
   * @param {BedrockCommand} cmd AWS Bedrock Command
   * @param {*} body InvokeModel response body
   */
  #extractCompletionsAndId(cmd, body) {
    if (cmd.isClaude() === true) {
      body.completion && this.#completions.push(body.completion)
    } else if (cmd.isClaude3() === true) {
      if (body?.type === 'message_stop') {
        // Streamed response
        this.#completions.push(body.completions)
      } else {
        this.#completions = [stringifyClaudeChunkedMessage(body?.content)]
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
}

module.exports = BedrockResponse
