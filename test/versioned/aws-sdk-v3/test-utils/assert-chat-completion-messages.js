/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = assertChatCompletionMessages

const assertChatCompletionMessage = require('./assert-chat-completion-message.js')

/**
 * Iterates a set of chat completion messages to determine if they meet
 * expectations.
 *
 * See {@link assertChatCompletionMessage} for further details.
 *
 * @param {object} params Function parameters.
 * @param {Transaction} params.tx Transaction containing the chat completion
 * message data.
 * @param {object[]} params.chatMsgs Set of messages to verify.
 * @param {string} [params.expectedId] When known ahead of time, the identifier
 * for the message. Otherwise, the `message.messageData.id` will be used.
 * @param {string} params.modelId Name of the LLM used to generate the
 * message data.
 * @param {string} params.prompt When the message being verified is not a
 * response message, this is the text that should be the expected `.content`
 * value.
 * @param {string} params.resContent The opposite of the `prompt` parameter.
 * This is the content when the message is a response from the LLM.
 * @param {boolean} [params.error] Indicates if the message is an error
 * message.
 *
 * @throws {Error} When any message cannot be validated.
 */
function assertChatCompletionMessages({ tx, chatMsgs, expectedId, modelId, prompt, resContent, error }) {
  chatMsgs.forEach((msg) => {
    if (msg[1].sequence > 1) {
      // Streamed responses may have more than two messages.
      // We only care about the start and end of the conversation.
      return
    }

    const isResponse = msg[1].sequence === 1
    assertChatCompletionMessage({
      tx,
      message: msg,
      expectedId,
      modelId,
      expectedContent: isResponse ? resContent : prompt,
      isResponse,
      error,
      expectedRole: isResponse ? 'assistant' : 'user'
    })
  })
}
