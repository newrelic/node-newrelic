/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Parses an AWS invoke command instance into a re-usable entity.
 */
class BedrockCommand {
  #input
  #body
  #modelId

  /**
   * @param {object} input The `input` property from an InvokeModelCommand or
   * InvokeModelWithResponseStreamCommand instance that is used for the
   * conversation.
   */
  constructor(input) {
    this.#input = input
    this.#body = JSON.parse(this.#input.body)
    this.#modelId = this.#input.modelId?.toLowerCase() ?? ''
  }

  /**
   * The maximum number of tokens allowed as defined by the user.
   *
   * @returns {number|undefined}
   */
  get maxTokens() {
    let result
    if (this.isAi21() === true) {
      result = this.#body.maxTokens
    } else if (this.isClaude() === true) {
      result = this.#body.max_tokens_to_sample
    } else if (this.isClaude3() === true || this.isCohere() === true) {
      result = this.#body.max_tokens
    } else if (this.isLlama() === true) {
      result = this.#body.max_gen_length
    } else if (this.isTitan() === true) {
      result = this.#body.textGenerationConfig?.maxTokenCount
    }
    return result
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
    let result
    if (this.isTitan() === true || this.isTitanEmbed() === true) {
      result = this.#body.inputText
    } else if (this.isCohereEmbed() === true) {
      result = this.#body.texts.join(' ')
    } else if (
      this.isClaude() === true ||
      this.isAi21() === true ||
      this.isCohere() === true ||
      this.isLlama() === true
    ) {
      result = this.#body.prompt
    } else if (this.isClaude3() === true) {
      result = this.#body?.messages?.reduce((acc, curr) => {
        acc += curr?.content ?? ''
        return acc
      }, '')
    }
    return result
  }

  /**
   * @returns {number|undefined}
   */
  get temperature() {
    let result
    if (this.isTitan() === true) {
      result = this.#body.textGenerationConfig?.temperature
    } else if (
      this.isClaude() === true ||
      this.isClaude3() === true ||
      this.isAi21() === true ||
      this.isCohere() === true ||
      this.isLlama() === true
    ) {
      result = this.#body.temperature
    }
    return result
  }

  isAi21() {
    return this.#modelId.startsWith('ai21.')
  }

  isClaude() {
    return this.#modelId.startsWith('anthropic.claude-v')
  }

  isClaude3() {
    return this.#modelId.startsWith('anthropic.claude-3')
  }

  isCohere() {
    return this.#modelId.startsWith('cohere.') && this.isCohereEmbed() === false
  }

  isCohereEmbed() {
    return this.#modelId.startsWith('cohere.embed')
  }

  isLlama() {
    return this.#modelId.startsWith('meta.llama')
  }

  isTitan() {
    return this.#modelId.startsWith('amazon.titan') && this.isTitanEmbed() === false
  }

  isTitanEmbed() {
    return this.#modelId.startsWith('amazon.titan-embed')
  }
}

module.exports = BedrockCommand
