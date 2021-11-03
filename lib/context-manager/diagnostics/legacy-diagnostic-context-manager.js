/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LegacyContextManager = require('../legacy-context-manager')

/**
 * Overrides setContext to add diagnostic logging around setting and removing
 * from context. Currently just supports the segment.probe().
 *
 * Exists in own class to keep default context management as minimal/efficient as possible
 * given we wrap pretty much every functions execution.
 */
class LegacyDiagnosticContextManager extends LegacyContextManager {
  setContext(newContext) {
    this._logDiagnostic(this._context, 'Removed from context')

    this._context = newContext

    this._logDiagnostic(newContext, 'Set in context')
  }

  _logDiagnostic(context, message) {
    // This is to currently support diagnostic logging of segments which gets attached to
    // transactions with a stack trace. All of this is output at once at the end of a transaction
    // when enabled for clear tracing.
    if (context && context.probe) {
      context.probe(message)
    }
  }
}

module.exports = LegacyDiagnosticContextManager
