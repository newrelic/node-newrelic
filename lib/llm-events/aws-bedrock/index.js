/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports = {
  LlmChatCompletionMessage: require('./chat-completion-message'),
  LlmChatCompletionSummary: require('./chat-completion-summary'),
  LlmEmbedding: require('./embedding'),
  LlmErrorMessage: require('./error-message'),
  // Helper classes to create the Llm events
  InvokeModelCommand: require('./invoke-model-command'),
  ConverseCommand: require('./converse-command'),
  InvokeModelResponse: require('./invoke-model-response'),
  ConverseResponse: require('./converse-response'),
}
