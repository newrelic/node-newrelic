/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyClaudeChunkedMessage } = require('./utils')

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
   * @returns {object[]} The array of context messages passed to the LLM (or a single user prompt for legacy "non-chat" models)
   */
  get prompt() {
    if (this.isTitan() === true || this.isTitanEmbed() === true) {
      return [
        {
          role: 'user',
          content: this.#body.inputText
        }
      ]
    } else if (this.isCohereEmbed() === true) {
      return [
        {
          role: 'user',
          content: this.#body.texts.join(' ')
        }
      ]
    } else if (
      this.isClaudeTextCompletionApi() === true ||
      this.isAi21() === true ||
      this.isCohere() === true ||
      this.isLlama() === true
    ) {
      return [{ role: 'user', content: this.#body.prompt }]
    } else if (this.isClaudeMessagesApi() === true) {
      return normalizeClaude3Messages(this.#body?.messages)
    }
    return []
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
    return this.#modelId.split('.').slice(-2).join('.').startsWith('anthropic.claude-v')
  }

  isClaude3() {
    return this.#modelId.split('.').slice(-2).join('.').startsWith('anthropic.claude-3')
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

  isClaudeMessagesApi() {
    return (this.isClaude3() === true || this.isClaude() === true) && 'messages' in this.#body
  }

  isClaudeTextCompletionApi() {
    return this.isClaude() === true && 'prompt' in this.#body
  }
}

/**
 * Claude v3 requests in Bedrock can have two different "chat" flavors. This function normalizes them into a consistent
 * format per the AIM agent spec
 *
 * @param messages - The raw array of messages passed to the invoke API
 * @returns {number|undefined} - The normalized messages
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

module.exports = BedrockCommand
