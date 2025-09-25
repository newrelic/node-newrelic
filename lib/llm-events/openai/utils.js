/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
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

  context['response.usage.prompt_tokens'] = response?.usage?.prompt_tokens || response?.usage?.input_tokens
  context['response.usage.completion_tokens'] = response?.usage?.completion_tokens || response?.usage?.output_tokens
  context['response.usage.total_tokens'] =
    response?.usage?.total_tokens || response?.usage?.totalTokens || getTotalTokenCount(context)
}

function tokenUsageAttributesExist(response) {
  const tokensExistA = response?.usage?.prompt_tokens && response?.usage?.completion_tokens
  const tokensExistB = response?.usage?.input_tokens && response?.usage?.output_tokens

  return !!(tokensExistA || tokensExistB)
}

module.exports = {
  tokenUsageAttributesExist,
  setUsageTokens
}
