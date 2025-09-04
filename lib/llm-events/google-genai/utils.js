/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: add function info here
function usageTokens(response, context) {
  if (tokenUsageAttributesExist(response)) {
    context['response.usage.prompt_tokens'] = response.usageMetadata.promptTokenCount
    context['response.usage.completion_tokens'] = response.usageMetadata.candidatesTokenCount
    context['response.usage.total_tokens'] = response.usageMetadata.totalTokenCount
  }
}

function tokenUsageAttributesExist(response) {
  return response?.usageMetadata?.promptTokenCount && response?.usageMetadata?.candidatesTokenCount && response?.usageMetadata?.totalTokenCount
}

// TODO: do we need to check for response headers?

module.exports = {
  tokenUsageAttributesExist,
  usageTokens
}
