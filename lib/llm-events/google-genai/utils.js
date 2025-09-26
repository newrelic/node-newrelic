/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { getTotalTokenCount } = require('../utils')

function setUsageTokens(response, context) {
  // input and output token counts must available in order to add all usage attributes to response
  // if total tokens is not available, we can manually add it up (from input and output token count)
  if (tokenUsageAttributesExist(response) === false) {
    return
  }

  context['response.usage.prompt_tokens'] = Number(response?.usageMetadata?.promptTokenCount)
  context['response.usage.completion_tokens'] = Number(response?.usageMetadata?.candidatesTokenCount)
  context['response.usage.total_tokens'] =
    Number(response?.usageMetadata?.totalTokenCount) || getTotalTokenCount(context)
}

function tokenUsageAttributesExist(response) {
  const tokens = response?.usageMetadata?.promptTokenCount && response?.usageMetadata?.candidatesTokenCount

  return tokens !== undefined
}
module.exports = {
  tokenUsageAttributesExist,
  setUsageTokens
}
