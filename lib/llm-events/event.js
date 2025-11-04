/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../config/attribute-filter')

class BaseLlmEvent {
  // eslint-disable-next-line accessor-pairs
  set metadata(agent) {
    const transaction = agent.tracer.getTransaction()
    const attrs = transaction?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE) || {}
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('llm.')) {
        this[key] = value
      }
    }
  }

  /**
   * Determines if the provided token count is valid.
   * A valid token count is greater than 0 and not null.
   * @param {number} tokenCount The token count obtained from the token callback
   * @returns {boolean} Whether the token count is valid
   */
  validTokenCount(tokenCount) {
    return tokenCount !== null && tokenCount > 0
  }

  /**
   * Calculates the total token count from the prompt tokens and completion tokens
   * set in the event.
   * @returns {number} The total token count
   */
  getTotalTokenCount() {
    return Number(this['response.usage.prompt_tokens']) + Number(this['response.usage.completion_tokens'])
  }

  setTokensOnEmbeddingMessage(totalTokens) {
    if (this.validTokenCount(totalTokens)) {
      this['response.usage.total_tokens'] = totalTokens
    }
  }

  /**
   * Sets the provided tokens counts on the LLM event.
   * Checks if promptToken and completionToken are greater than zero before setting.
   * This is because the spec states that token counts should only be set if both
   * are present.
   * @param {object} params to the function
   * @param {object} params.promptTokens value of prompt token count
   * @param {object} params.completionTokens value of completion(s) token count
   * @param {object} params.totalTokens value of prompt + completion(s) token count
   */
  setTokensInResponse({ promptTokens, completionTokens, totalTokens }) {
    if (this.validTokenCount(promptTokens) && this.validTokenCount(completionTokens)) {
      this['response.usage.prompt_tokens'] = promptTokens
      this['response.usage.completion_tokens'] = completionTokens
      this['response.usage.total_tokens'] = totalTokens || this.getTotalTokenCount()
    }
  }

  /**
   * Sets `token_count` to 0 on the LlmChatCompletionMessage if both prompt and completion tokens are greater than zero.
   * This is because the spec states that if token counts are set, then we should set token_count to 0 to indicate
   * that the token calculation does not have to occur in the ingest pipeline.
   * @param {object} params to the function
   * @param {object} params.promptTokens value of prompt token count
   * @param {object} params.completionTokens value of completion(s) token count
   */
  setTokenInCompletionMessage({ promptTokens, completionTokens }) {
    if (this.validTokenCount(promptTokens) && this.validTokenCount(completionTokens)) {
      this.token_count = 0
    }
  }

  /**
   * Calculates prompt and completion token counts using the provided callback and models.
   * If both counts are valid, sets this.token_count to 0.
   *
   * @param {object} options - The params object.
   * @param {Function} options.tokenCB - The token counting callback function.
   * @param {string} options.reqModel - The model used for the prompt.
   * @param {string} options.resModel - The model used for the completion.
   * @param {string} options.promptContent - The prompt content to count tokens for.
   * @param {string} options.completionContent - The completion content to count tokens for.
   * @returns {void}
   */
  setTokenFromCallback({ tokenCB, reqModel, resModel, promptContent, completionContent }) {
    const promptToken = this.calculateCallbackTokens(tokenCB, reqModel, promptContent)
    const completionToken = this.calculateCallbackTokens(tokenCB, resModel, completionContent)

    this.setTokenInCompletionMessage({ promptTokens: promptToken, completionTokens: completionToken })
  }

  /**
   * Calculates prompt and completion token counts using the provided callback and models.
   * If both counts are valid, sets token prompt, completion and total counts on the event.
   *
   * @param {object} options - The params object.
   * @param {Function} options.tokenCB - The token counting callback function.
   * @param {string} options.reqModel - The model used for the prompt.
   * @param {string} options.resModel - The model used for the completion.
   * @param {string} options.promptContent - The prompt content to count tokens for.
   * @param {string} options.completionContent - The completion content to count tokens for.
   * @returns {void}
   */
  setTokenUsageFromCallback({ tokenCB, reqModel, resModel, promptContent, completionContent }) {
    const promptTokens = this.calculateCallbackTokens(tokenCB, reqModel, promptContent)
    const completionTokens = this.calculateCallbackTokens(tokenCB, resModel, completionContent)
    this.setTokensInResponse({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens })
  }

  /**
   * Calculate the token counts using the provided callback.
   * @param {Function} tokenCB - The token count callback function.
   * @param {string} model - The model.
   * @param {string} content - The content to calculate tokens for, such as prompt or completion response.
   * @returns {number|undefined} - The calculated token count or undefined if callback is not a function.
   */
  calculateCallbackTokens(tokenCB, model, content) {
    if (typeof tokenCB === 'function') {
      return tokenCB(model, content)
    }
    return undefined
  }
}

module.exports = BaseLlmEvent
