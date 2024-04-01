/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')

/**
 * @typedef {object} LlmChatCompletionSummaryParams
 * @augments LlmEventParams
 */
/**
 * @type {LlmChatCompletionSummaryParams}
 */
const defaultParams = {}

/**
 * Represents an LLM chat completion summary.
 */
class LlmChatCompletionSummary extends LlmEvent {
  constructor(params = defaultParams) {
    super(params)

    const { segment, isError } = params
    this.error = isError
    this.duration = segment.getDurationInMillis()
    this['request.max_tokens'] = this.bedrockCommand.maxTokens

    const nm = 'response.number_of_messages'
    const cfr = 'response.choices.finish_reason'
    const rt = 'request.temperature'

    const cmd = this.bedrockCommand
    this[cfr] = this.bedrockResponse.finishReason
    this[rt] = cmd.temperature
    this[nm] = 1 + this.bedrockResponse.completions.length
  }
}

module.exports = LlmChatCompletionSummary
