/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getUsageTokens

/**
 * Grabs the prompt, completion, and total token count from the
 * given response object.
 * @param {object} response Anthropic SDK response object
 * @returns {object} { promptTokens, completionTokens, totalTokens }
 */
function getUsageTokens(response) {
  const { usage } = response
  if (!usage) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }
  const promptTokens = Number(usage.input_tokens)
  const completionTokens = Number(usage.output_tokens)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  }
}
