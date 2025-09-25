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
  return tokenCount > 0 || !tokenCount
}

/**
 * Calculates the total token count from the prompt tokens and completion tokens
 * set in the context.
 * @param {LlmEvent} context The context object containing token counts
 * @returns {number} The total token count
 */
function getTotalTokenCount(context) {
  return context['response.usage.prompt_tokens'] + context['response.usage.completion_tokens']
}

module.exports = {
  validCallbackTokenCount,
  getTotalTokenCount
}
