/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmErrorMessage = require('../error-message')

/**
 * AWS Bedrock-specific LLM error message.
 * Uses `cause.name` as the error code instead of the default error code resolution.
 *
 * @augments LlmErrorMessage
 */
module.exports = class AwsBedrockLlmErrorMessage extends LlmErrorMessage {
  constructor(params = {}) {
    super(params)
    if (params.cause?.name) {
      this['error.code'] = params.cause.name
    }
  }
}
