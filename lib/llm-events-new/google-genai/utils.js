/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

function getUsageTokens(response) {
  const promptTokens = Number(response?.usageMetadata?.promptTokenCount)
  const completionTokens = Number(response?.usageMetadata?.candidatesTokenCount)
  const totalTokens = Number(response?.usageMetadata?.totalTokenCount)
  return { promptTokens, completionTokens, totalTokens }
}

module.exports = { getUsageTokens }
