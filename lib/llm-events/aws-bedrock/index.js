/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  LlmChatCompletionMessage: require('./chat-completion-message'),
  LlmChatCompletionSummary: require('./chat-completion-summary'),
  LlmEmbedding: require('./embedding'),
  // Helper classes to create the Llm events
  BedrockCommand: require('./bedrock-command'),
  BedrockResponse: require('./bedrock-response'),
}
