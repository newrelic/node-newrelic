/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyConverseChunkedMessage } = require('./utils')

/**
 * Parses an AWS invoke command instance into a re-usable entity.
 */
class BedrockConverseCommand {
  #input
  #messages
  #modelId

  /**
   * @param {object} input The `input` property from an InvokeModelCommand or
   * InvokeModelWithResponseStreamCommand instance that is used for the
   * conversation.
   */
  constructor(input) {
    this.#input = input
    this.#messages = input.messages
    this.#modelId = input.modelId?.toLowerCase() ?? ''
  }

  /**
   * The maximum number of tokens allowed as defined by the user.
   *
   * @returns {number|undefined}
   */
  get maxTokens() {
    return this.#input.inferenceConfig.maxTokens
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
    // At the moment, this is a simple check. If Amazon ever introduces a
    // complex identifier, we can implement a more complicated check.
    return this.#modelId.toLowerCase().includes('embed') ? 'embedding' : 'completion'
  }

  /**
   * The question posed to the LLM.
   *
   * @returns {string|string[]|undefined}
   */
  get prompt() {
    const result = []
    for (const message of this.#messages) {
      if (typeof message?.content === 'string') {
        result.push({ role: message.role, content: message?.content })
      } else if (message?.content != null && Array.isArray(message.content)) {
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
    return this.#input.inferenceConfig.temperature
  }
}

module.exports = BedrockConverseCommand
