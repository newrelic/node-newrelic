/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyClaudeChunkedMessage } = require('./stringify-message')
const ModelCommand = require('./model-command')

/**
 * Parses an AWS Bedrock `InvokeModel`/`InvokeModelWithResponseStream` command
 * instance into a re-usable entity.
 */
class InvokeModelCommand extends ModelCommand {
  #input
  #body

  /**
   * @param {object} input The `input` property from an `InvokeModelCommand`
   * or `InvokeModelWithResponseStreamCommand` instance.
   */
  constructor(input) {
    super(input)
    this.#input = input
    this.#body = JSON.parse(this.#input.body)
  }

  /**
   * The maximum number of tokens allowed as defined by the user.
   *
   * @returns {number|undefined}
   */
  get maxTokens() {
    if (this.isClaudePromptApi() === true) {
      return this.#body.max_tokens_to_sample
    }
    if (this.isClaudeMessagesApi() === true || this.isCohere() === true) {
      return this.#body.max_tokens
    }
    if (this.isLlama() === true) {
      return this.#body.max_gen_length
    }
    if (this.isTitan() === true) {
      return this.#body.textGenerationConfig?.maxTokenCount
    }
  }

  /**
   * The question posed to the LLM.
   *
   * @returns {string|string[]|object[]}
   */
  get prompt() {
    if (this.isTitan() || this.isTitanEmbed()) {
      return [{ role: 'user', content: this.#body.inputText }]
    }

    if (this.isCohereEmbed()) {
      return [{ role: 'user', content: this.#body.texts.join(' ') }]
    }

    if (
      this.isClaudePromptApi() ||
      this.isCohere() ||
      this.isLlama()
    ) {
      return [{ role: 'user', content: this.#body.prompt }]
    }

    if (this.isClaudeMessagesApi()) {
      return normalizeClaudeMessages(this.#body?.messages)
    }

    return []
  }

  /**
   * @returns {number|undefined}
   */
  get temperature() {
    if (this.isTitan() === true) {
      return this.#body.textGenerationConfig?.temperature
    }
    if (
      this.isClaudePromptApi() === true ||
        this.isClaudeMessagesApi() === true ||
        this.isCohere() === true ||
        this.isLlama() === true
    ) {
      return this.#body.temperature
    }
  }

  // Helper methods to determine which LLM vendor was used based on modelId
  /**
   * Detects if the command used the Claude Text Completions API (v1/v2)
   * via the presence of the `prompt` field on the body.
   * @returns {boolean} True if the command used a Claude model and the Claude Text Completions API.
   */
  isClaudePromptApi() {
    const matchesModelId = this.modelId.split('.').slice(-2).join('.').startsWith('anthropic.claude-v')
    const matchesBodyShape = !!this.#body.anthropic_version && 'prompt' in this.#body
    return matchesModelId || matchesBodyShape
  }

  /**
   * Detects if the command used the Claude Messages API (v3+)
   * via the presence of the `messages` field on the body.
   * @returns {boolean} True if the command used a Claude model and the Claude Messages API.
   */
  isClaudeMessagesApi() {
    const strippedModelId = this.modelId.split('.').slice(-2).join('.')
    const matchesModelId = strippedModelId.startsWith('anthropic.claude-') && !strippedModelId.startsWith('anthropic.claude-v')
    const matchesBodyShape = !!this.#body.anthropic_version && 'messages' in this.#body
    return matchesModelId || matchesBodyShape
  }

  isCohere() {
    return this.modelId.startsWith('cohere.') && this.isCohereEmbed() === false
  }

  isCohereEmbed() {
    return this.modelId.startsWith('cohere.embed')
  }

  isLlama() {
    return this.modelId.startsWith('meta.llama')
  }

  isTitan() {
    return this.modelId.startsWith('amazon.titan') && this.isTitanEmbed() === false
  }

  isTitanEmbed() {
    return this.modelId.startsWith('amazon.titan-embed')
  }
}

/**
 * Claude Messages API requests in Bedrock can have two different "chat" flavors.
 * This function normalizes them into a consistent format per the AIM agent spec.
 *
 * @param {Array<object>} messages - The raw array of messages passed to the invoke API
 * @returns {Array<object>} - The normalized messages
 */
function normalizeClaudeMessages(messages) {
  const result = []
  for (const message of messages ?? []) {
    if (message == null) {
      continue
    }
    if (typeof message.content === 'string') {
      // Messages can be specified with plain string content
      result.push({ role: message.role, content: message.content })
    } else if (Array.isArray(message.content)) {
      // Or in a "chunked" format for multi-modal support
      result.push({
        role: message.role,
        content: stringifyClaudeChunkedMessage(message.content)
      })
    }
  }
  return result
}

module.exports = InvokeModelCommand
