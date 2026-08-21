/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyConverseChunkedMessage } = require('./stringify-message')

/**
 * Parses an AWS Bedrock `ConverseCommand`/`ConverseStreamCommand`
 * instance into a re-usable entity.
 */
class ConverseCommand {
  #input
  #modelId
  #messages

  /**
   * @param {object} input The `input` property from a `ConverseCommand`
   * or `ConverseStreamCommand` instance.
   */
  constructor(input) {
    this.#input = input
    this.#modelId = input.modelId?.toLowerCase() ?? ''
    this.#messages = input.messages
  }

  /**
   * @returns {boolean} Always `true`, this command is from the Converse API.
   */
  get isConverse() {
    return true
  }

  /**
   * The maximum number of tokens allowed as defined by the user.
   *
   * @returns {number|undefined}
   */
  get maxTokens() {
    return this.#input?.inferenceConfig?.maxTokens
  }

  /**
   * The model identifier for the command.
   *
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   *
   * @returns {string}
   */
  get modelId() {
    return this.#modelId
  }

  /**
   * @returns {string} One of `embedding` or `completion`.
   */
  get modelType() {
    return this.#modelId.toLowerCase().includes('embed') ? 'embedding' : 'completion'
  }

  /**
   * The question posed to the LLM.
   *
   * @returns {object[]}
   */
  get prompt() {
    const result = []
    for (const message of this.#messages) {
      // The `message.content` field is an array of ContentBlock objects.
      // For text messages, the structure is: content: [{ text: '...' }]
      if (Array.isArray(message?.content) === true) {
        result.push({
          role: message.role,
          content: stringifyConverseChunkedMessage(message.content)
        })
      }
    }
    return result
  }

  /**
   * @returns {number|undefined}
   */
  get temperature() {
    return this.#input?.inferenceConfig?.temperature
  }
}

module.exports = ConverseCommand
