/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { stringifyClaudeChunkedMessage, stringifyConverseChunkedMessage } = require('./utils')

/**
 * Parses an AWS Bedrock command instance into a re-usable entity,
 * unifying logic for both InvokeModel and Converse commands.
 */
class BedrockCommand {
  #input
  #modelId
  #body
  #messages
  #isConverseCommand

  /**
   * @param {object} input The `input` property from an InvokeModelCommand,
   * InvokeModelWithResponseStreamCommand, ConverseCommand, or
   * ConverseStreamCommand instance.
   */
  constructor(input) {
    this.#input = input
    this.#modelId = this.#input.modelId?.toLowerCase() ?? ''

    if (Object.hasOwn(input, 'body') === true) {
      this.#body = JSON.parse(this.#input.body)
      this.#isConverseCommand = false
    } else if (Object.hasOwn(input, 'messages') === true) {
      this.#messages = input.messages
      this.#isConverseCommand = true
    }
  }

  /**
   *
   * @returns {boolean} True if the command is from the Converse API.
   */
  get isConverse() {
    return this.#isConverseCommand
  }

  /**
   * The maximum number of tokens allowed as defined by the user.
   *
   * @returns {number|undefined}
   */
  get maxTokens() {
    if (this.#isConverseCommand) {
      // Logic for Converse
      return this.#input?.inferenceConfig?.maxTokens
    } else {
      // Logic for InvokeModel
      let result
      if (this.isClaude() === true) {
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
    // This logic is common to both command types
    return this.#modelId.toLowerCase().includes('embed') ? 'embedding' : 'completion'
  }

  /**
   * The question posed to the LLM.
   *
   * @returns {string|string[]|object[]|undefined}
   */
  get prompt() {
    if (this.#isConverseCommand) {
      // Logic for Converse
      const result = []
      for (const message of this.#messages) {
        if (typeof message?.content === 'string') {
          result.push({ role: message.role, content: message?.content })
        } else if (Array.isArray(message.content) === true) {
          result.push({
            role: message.role,
            content: stringifyConverseChunkedMessage(message.content)
          })
        }
      }
      return result
    } else {
      // Logic for InvokeModel
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
        this.isClaudeTextCompletionApi(this.#body) === true ||
        this.isCohere() === true ||
        this.isLlama() === true
      ) {
        return [{ role: 'user', content: this.#body.prompt }]
      } else if (this.isClaudeMessagesApi(this.#body) === true) {
        return normalizeClaude3Messages(this.#body?.messages)
      }
      return []
    }
  }

  /**
   * @returns {number|undefined}
   */
  get temperature() {
    if (this.#isConverseCommand) {
      // Logic for Converse
      return this.#input?.inferenceConfig?.temperature
    } else {
      // Logic for InvokeModel
      let result
      if (this.isTitan() === true) {
        result = this.#body.textGenerationConfig?.temperature
      } else if (
        this.isClaude() === true ||
        this.isClaude3() === true ||
        this.isCohere() === true ||
        this.isLlama() === true
      ) {
        result = this.#body.temperature
      }
      return result
    }
  }

  // Helper methods that depend on modelId (common to both types)
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

  // These methods are specific to the InvokeModelCommand's body structure
  // and will only be called when isConverse is false.
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

module.exports = BedrockCommand
