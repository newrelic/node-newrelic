/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function setUsageTokens(response, context) {
  if (tokenUsageAttributesExist(response)) {
    context['response.usage.prompt_tokens'] = response.usage.prompt_tokens || response.usage.input_tokens
    context['response.usage.completion_tokens'] = response.usage.completion_tokens || response.usage.output_tokens
    context['response.usage.total_tokens'] = response.usage.total_tokens || response.usage.totalTokens
  }
}

function tokenUsageAttributesExist(response) {
  return (response?.usage?.completion_tokens && response?.usage?.prompt_tokens && response?.usage?.total_tokens) ||
    (response?.usage?.input_tokens && response?.usage?.output_tokens && response?.usage?.total_tokens)
}

module.exports = {
  tokenUsageAttributesExist,
  setUsageTokens
}
