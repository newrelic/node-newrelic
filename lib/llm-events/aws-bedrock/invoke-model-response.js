/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyClaudeChunkedMessage } = require('./stringify-message')
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
 * Represents a response from the Bedrock `InvokeModel`/`InvokeModelWithResponseStream`
 * API. This object provides an abstraction that normalizes responses into a known
 * interface and simplifies accessing desired fields, accommodating the varied
 * shapes of Bedrock API responses.
 */
class InvokeModelResponse extends ModelResponse {
  #originalResponse
  #innerOutput
  #parsedBody
  #command
  #completions = []
  #id

  /**
   * @param {object} params params object
   * @param {AwsBedrockMiddlewareResponse} params.response AWS Bedrock middleware response
   * @param {InvokeModelCommand} params.bedrockCommand AWS Bedrock command
   * @param {boolean} params.isError is there an error
   */
  constructor({ response, bedrockCommand, isError = false }) {
    super({ response, isError })
    this.#originalResponse = response
    this.#command = bedrockCommand

    if (this.isError) {
      return
    }

    this.#innerOutput = response.output
    const json = new TextDecoder().decode(this.#innerOutput.body)
    this.#parsedBody = JSON.parse(json)

    const cmd = this.#command
    const body = this.#parsedBody
    this.#extractCompletionsAndId(cmd, body)
  }

  /**
   * @returns {number} The number of tokens in the prompt.
   */
  get inputTokenCount() {
    return parseInt(this?.headers?.['x-amzn-bedrock-input-token-count'] || 0, 10)
  }

  /**
   * @returns {number} The number of tokens in the completion.
   */
  get outputTokenCount() {
    return parseInt(this?.headers?.['x-amzn-bedrock-output-token-count'] || 0, 10)
  }

  /**
   * @returns {number} The total number of tokens used by the request and response.
   */
  get totalTokenCount() {
    return this.inputTokenCount + this.outputTokenCount
  }

  /**
   * The prompt responses returned by the model.
   *
   * @returns {string[]|Array<*>} Should be an array of string responses to the
   * prompt.
   */
  get completions() {
    return this.#completions
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
   * Retrieve the response identifier provided by some model responses.
   *
   * @returns {string|undefined}
   */
  get id() {
    return this.#id
  }

  /**
   * Extracts and sets #completions and #id from the InvokeModel response body.
   * @param {InvokeModelCommand} cmd AWS Bedrock Command
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

module.exports = InvokeModelResponse
