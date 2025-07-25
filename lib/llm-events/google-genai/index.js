/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmChatCompletionSummary = require('./chat-completion-summary')
const LlmChatCompletionMessage = require('./chat-completion-message')
const LlmEmbedding = require('./embedding')
const LlmErrorMessage = require('../error-message')

module.exports = {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmErrorMessage
}
