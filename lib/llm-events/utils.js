/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Determines if the provided token count is valid.
 * A valid token count is greater than 0 and not null.
 * @param {number} tokenCount The token count obtained from the token callback
 * @returns {boolean} Whether the token count is valid
 */
function validCallbackTokenCount(tokenCount) {
  return tokenCount !== null && tokenCount > 0
}

/**
 * Calculates the total token count from the prompt tokens and completion tokens
 * set in the context.
 * @param {LlmEvent} context The context object containing token counts
 * @returns {number} The total token count
 */
function getTotalTokenCount(context) {
  return Number(context['response.usage.prompt_tokens']) + Number(context['response.usage.completion_tokens'])
}

function setTokensInResponse(context, tokens) {
  context['response.usage.prompt_tokens'] = tokens.promptTokens
  context['response.usage.completion_tokens'] = tokens.completionTokens
  context['response.usage.total_tokens'] = tokens.totalTokens || getTotalTokenCount(context)
}

function setTokenFromCallback({ context, tokenCB, reqModel, resModel, promptContent, completionContent }) {
  const promptToken = calculateCallbackTokens(tokenCB, reqModel, promptContent)
  const completionToken = calculateCallbackTokens(tokenCB, resModel, completionContent)

  const hasValidCallbackCounts =
    validCallbackTokenCount(promptToken) && validCallbackTokenCount(completionToken)

  if (hasValidCallbackCounts) {
    context.token_count = 0
  }
}

function setTokenUsageFromCallback({ context, tokenCB, reqModel, resModel, promptContent, completionContent }) {
  const promptTokens = calculateCallbackTokens(tokenCB, reqModel, promptContent)
  const completionTokens = calculateCallbackTokens(tokenCB, resModel, completionContent)

  const hasValidCallbackCounts =
    validCallbackTokenCount(promptTokens) && validCallbackTokenCount(completionTokens)

  if (hasValidCallbackCounts) {
    setTokensInResponse(context, { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens })
  }
}

/**
 * Calculate the token counts using the provided callback.
 * @param {Function} tokenCB - The token count callback function.
 * @param {string} model - The model.
 * @param {string} content - The content to calculate tokens for, such as prompt or completion response.
 * @returns {number|undefined} - The calculated token count or undefined if callback is not a function.
 */
function calculateCallbackTokens(tokenCB, model, content) {
  if (typeof tokenCB === 'function') {
    return tokenCB(model, content)
  }
  return undefined
}

module.exports = {
  validCallbackTokenCount,
  getTotalTokenCount,
  setTokensInResponse,
  setTokenFromCallback,
  setTokenUsageFromCallback,
  calculateCallbackTokens
}
