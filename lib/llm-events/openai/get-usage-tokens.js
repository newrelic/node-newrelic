/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getUsageTokens

/**
 * Retrieves the OpenAI usage tokens.
 * @param {object} response OpenAI response object
 * @returns {object} { promptTokens, completionTokens, totalTokens }
 */
function getUsageTokens(response) {
  const promptTokens = Number(response?.usage?.prompt_tokens || response?.usage?.input_tokens)
  const completionTokens = Number(response?.usage?.completion_tokens || response?.usage?.output_tokens)
  const totalTokens = Number(response?.usage?.total_tokens || response?.usage?.totalTokens)
  return { promptTokens, completionTokens, totalTokens }
}
