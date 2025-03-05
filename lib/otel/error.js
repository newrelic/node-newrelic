/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents an error object, to be tracked via `agent.errors`, that is the
 * result of some error from an OTEL span.
 */

'use strict'
module.exports = class OtelError extends Error {
  /**
   * @param {string} msg The error message.
   * @param {string} stack The error stack.
   */
  constructor(msg, stack) {
    super(msg)
    this.stack = stack
  }
}
