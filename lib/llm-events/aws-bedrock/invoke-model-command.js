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
    if (this.isClaude() === true) {
      return this.#body.max_tokens_to_sample
    }
    if (this.isClaude3() === true || this.isCohere() === true) {
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
      this.isClaudeTextCompletionApi(this.#body) ||
      this.isCohere() ||
      this.isLlama()
    ) {
      return [{ role: 'user', content: this.#body.prompt }]
    }

    if (this.isClaudeMessagesApi(this.#body)) {
      return normalizeClaude3Messages(this.#body?.messages)
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
      this.isClaude() === true ||
        this.isClaude3() === true ||
        this.isCohere() === true ||
        this.isLlama() === true
    ) {
      return this.#body.temperature
    }
  }

  // Helper methods to determine which LLM vendor was used based on modelId
  isClaude() {
    return this.modelId.split('.').slice(-2).join('.').startsWith('anthropic.claude-v')
  }

  isClaude3() {
    return this.modelId.split('.').slice(-2).join('.').startsWith('anthropic.claude-3')
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

  isClaudeMessagesApi(body) {
    return (this.isClaude3() === true || this.isClaude() === true) && 'messages' in body
  }

  isClaudeTextCompletionApi(body) {
    return this.isClaude() === true && 'prompt' in body
  }
}

/**
 * Claude v3 requests in Bedrock can have two different "chat" flavors.
 * This function normalizes them into a consistent
 * format per the AIM agent spec
 *
 * @param {Array<object>} messages - The raw array of messages passed to the invoke API
 * @returns {Array<object>} - The normalized messages
 */
function normalizeClaude3Messages(messages) {
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
