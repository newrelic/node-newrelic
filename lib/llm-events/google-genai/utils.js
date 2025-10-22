/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { setTokensInResponse } = require('../utils')

function setUsageTokens(response, context) {
  // prompt and completion token counts must available in order to add all usage attributes to response
  // if total tokens is not available, we can manually add it up (from input and output token count)
  if (tokenUsageAttributesExist(response) === false) {
    return
  }

  const promptTokens = Number(response?.usageMetadata?.promptTokenCount)
  const completionTokens = Number(response?.usageMetadata?.candidatesTokenCount)
  const totalTokens = Number(response?.usageMetadata?.totalTokenCount)

  setTokensInResponse(context, { promptTokens, completionTokens, totalTokens })
}

function tokenUsageAttributesExist(response) {
  const tokens = response?.usageMetadata?.promptTokenCount && response?.usageMetadata?.candidatesTokenCount

  return tokens !== undefined
}
module.exports = {
  tokenUsageAttributesExist,
  setUsageTokens
}
