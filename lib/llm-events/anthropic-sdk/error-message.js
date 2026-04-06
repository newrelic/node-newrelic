/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmErrorMessage = require('../error-message')

module.exports = class AnthrophicLlmErrorMessage extends LlmErrorMessage {
  constructor(params = {}) {
    super(params)
    const { cause } = params
    // Anthropic SDK errors seem to have two different formats:
    // `cause.cause` and `cause.error.error`

    // For errors like 'Connection error', attributes live on `cause.cause`.
    if (cause?.cause?.message) {
      // `cause.cause.message` is more verbose than `cause.message`,
      // so we'll use it instead
      this['error.message'] = cause.cause.message
    }
    // For errors like 'UnprocessableEntityError', there is also
    // `cause.error.error.message` but it is actually less verbose
    // than `cause.message`, so we'll use `cause.message` in this case.
    if (cause?.error?.error?.code) {
      this['error.code'] = cause.error.error.code
    }
  }
}
