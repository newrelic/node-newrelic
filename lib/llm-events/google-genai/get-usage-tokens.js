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
  const { usageMetadata } = response
  if (!usageMetadata) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }
  return {
    promptTokens: Number(usageMetadata.promptTokenCount),
    completionTokens: Number(usageMetadata.candidatesTokenCount),
    totalTokens: Number(usageMetadata.totalTokenCount)
  }
}
