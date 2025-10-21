/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { setTokensInResponse } = require('../utils')

function setUsageTokens(response, context) {
  // input and output token counts must available in order to add all usage attributes to response
  // if total tokens is not available, we can manually add it up (from input and output token count)
  if (tokenUsageAttributesExist(response) === false) {
    return
  }

  const promptTokens = Number(response?.usage?.prompt_tokens || response?.usage?.input_tokens)
  const completionTokens = Number(response?.usage?.completion_tokens || response?.usage?.output_tokens)
  const totalTokens = Number(response?.usage?.total_tokens || response?.usage?.totalTokens)

  setTokensInResponse(context, { promptTokens, completionTokens, totalTokens })
}

function tokenUsageAttributesExist(response) {
  const tokensA = response?.usage?.prompt_tokens && response?.usage?.completion_tokens
  const tokensB = response?.usage?.input_tokens && response?.usage?.output_tokens

  return tokensA !== undefined || tokensB !== undefined
}

module.exports = {
  tokenUsageAttributesExist,
  setUsageTokens
}
