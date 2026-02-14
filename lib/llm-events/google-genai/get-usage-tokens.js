/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getUsageTokens

/**
 * Grabs the prompt, completion, and total token count from the
 * given response object.
 * @param {object} response Google Gen AI response object
 * @returns {object} { promptTokens, completionTokens, totalTokens }
 */
function getUsageTokens(response) {
  const promptTokens = Number(response?.usageMetadata?.promptTokenCount)
  const completionTokens = Number(response?.usageMetadata?.candidatesTokenCount)
  const totalTokens = Number(response?.usageMetadata?.totalTokenCount)
  return { promptTokens, completionTokens, totalTokens }
}
