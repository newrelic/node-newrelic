/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Represents the identifiers created and collected when creating LLM
 * chat completions.
 *
 * @property {string[]} [message_ids=[]] Internal identifiers for each message
 * sent in the conversation.
 * @property {string} [coversation_id=""] User defined identifier of the chat
 * completion conversation.
 * @property {string} request_id Identifier of the request from the remote
 * service for a chat completion. Populated by the `x-request-id` header
 * in the request.
 * @public
 */
module.exports = class LlmTrackedIds {
  constructor({ messageIds, conversationId = '', requestId } = {}) {
    this.message_ids = messageIds ?? []
    this.conversation_id = conversationId
    this.request_id = requestId
  }
}
