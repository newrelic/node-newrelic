/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('./base')
const shimmer = require('../../shimmer')
const symbols = require('../../symbols')

/**
 * Captures `uncaughtException` and `unhandledRejection` as agent errors. Unlike
 * the other core subscribers this one creates no segments and publishes to no
 * tracing channels; it only patches `process` so the errors get reported.
 */
class GlobalsSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'globals' })
  }

  /**
   * `globals` is not a module. The methods being patched live on `process`.
   *
   * @returns {object} the global `process` object
   */
  resolveModule() {
    return process
  }

  instrument(globals) {
    const self = this
    const { agent } = this
    // Shared across all three wrappers: `setUncaughtExceptionCaptureCallback`
    // records whether the application installed its own handler, and
    // `_fatalException` defers to it.
    let exceptionCallbackRegistered = false

    // `_fatalException` is an undocumented feature of domains, introduced in
    // Node.js v0.8. We use `_fatalException` because wrapping it will not
    // potentially change the behavior of the server unlike listening for
    // `uncaughtException`.
    shimmer.wrapMethod(globals, 'globals', '_fatalException', function wrapFatalException(original) {
      return function wrappedFatalException(error) {
        // Only record the error if we are not currently within an instrumented
        // domain. In serverless mode, this will be handled by its own _fatalException wrapper.
        if (
          agent.serverlessMode === false &&
          !process.domain &&
          !exceptionCallbackRegistered
        ) {
          agent.errors.add(null, error)
        }
        return original.apply(this, arguments)
      }
    })

    shimmer.wrapMethod(globals, 'globals', 'emit', function wrapEmit(original) {
      return function wrappedEmit(ev, error, promise) {
        // Check for unhandledRejections here so we don't change the behavior of
        // the event.
        if (
          ev === 'unhandledRejection' &&
          error &&
          !process.domain &&
          process.listenerCount('unhandledRejection') === 0
        ) {
          const tx = promise[symbols.context] && promise[symbols.context].getTransaction()
          self.logger.trace('Captured unhandled rejection for transaction %s', tx && tx.id)
          agent.errors.add(tx, error)
        }

        return original.apply(this, arguments)
      }
    })

    shimmer.wrapMethod(globals, 'globals', 'setUncaughtExceptionCaptureCallback', function wrapUncaughtExceptionCallback(original) {
      return function wrappedUncaughtExceptionCallback(fn) {
        exceptionCallbackRegistered = fn !== null
        return original.apply(this, arguments)
      }
    })
  }
}

module.exports = GlobalsSubscriber
