/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
const { usageTokens } = require('../aws-bedrock/utils')
/**
 * @typedef {object} LlmChatCompletionSummaryParams
 * @augments LlmEventParams
 * @property
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

    const cmd = this.bedrockCommand
    const res = this.bedrockResponse

    this['request.max_tokens'] = cmd.maxTokens
    this['response.choices.finish_reason'] = res.finishReason
    this['request.temperature'] = cmd.temperature
    this['response.number_of_messages'] = (cmd.prompt.length ?? 0) + (res.completions.length ?? 0)

    // TODO: do we only do this when record_content is enabled?
    usageTokens(params.bedrockResponse, this)
  }
}

module.exports = LlmChatCompletionSummary
