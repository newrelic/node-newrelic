/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  LlmChatCompletionMessage: require('./chat-message'),
  LlmChatCompletionSummary: require('./chat-summary'),
  LlmEmbedding: require('./embedding'),
  // Helper classes to create the Llm events
  BedrockCommand: require('./bedrock-command'),
  BedrockResponse: require('./bedrock-response'),
}
