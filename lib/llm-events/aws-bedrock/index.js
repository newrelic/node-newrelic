/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  BedrockCommand: require('./bedrock-command'),
  BedrockResponse: require('./bedrock-response'),
  LlmChatCompletionMessage: require('./chat-completion-message'),
  LlmChatCompletionSummary: require('./chat-completion-summary'),
  LlmEmbedding: require('./embedding'),
  LlmEvent: require('./event'),
  LlmErrorMessage: require('../error-message'),
  StreamHandler: require('./stream-handler'),
  ConverseStreamHandler: require('./converse-stream-handler')
}
