/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyConverseChunkedMessage } = require('./stringify-message')
const ModelCommand = require('./model-command')

/**
 * Parses an AWS Bedrock `ConverseCommand`/`ConverseStreamCommand`
 * instance into a re-usable entity.
 */
class ConverseCommand extends ModelCommand {
  #input
  #messages

  /**
   * @param {object} input The `input` property from a `ConverseCommand`
   * or `ConverseStreamCommand` instance.
   */
  constructor(input) {
    super(input)
    this.#input = input
    this.#messages = input.messages
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
