/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const symbols = require('../../symbols')

module.exports = initialize

function initialize(agent, nodule, name, shim) {
  let exceptionCallbackRegistered = false

  // `_fatalException` is an undocumented feature of domains, introduced in
  // Node.js v0.8. We use `_fatalException` because wrapping it will not
  // potentially change the behavior of the server unlike listening for
  // `uncaughtException`.
  shim.wrap(process, '_fatalException', function wrapper(shim, original) {
    return function wrappedFatalException(error) {
      // Only record the error if we are not currently within an instrumented
      // domain.
      // In serverless mode this will be handled by its own _fatalException wrapper
      if (
        !shim.agent.config.serverless_mode.enabled &&
        !process.domain &&
        !exceptionCallbackRegistered
      ) {
        agent.errors.add(null, error)
        shim.setActiveSegment(null)
      }
      return original.apply(this, arguments)
    }
  })

  shim.wrap(process, 'emit', function wrapEmit(shim, original) {
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
        shim.logger.trace('Captured unhandled rejection for transaction %s', tx && tx.id)
        agent.errors.add(tx, error)
      }

      return original.apply(this, arguments)
    }
  })

  shim.wrap(process, 'setUncaughtExceptionCaptureCallback', wrapUncaughtExceptionCallback)

  function wrapUncaughtExceptionCallback(shim, original) {
    return function wrapped(fn) {
      exceptionCallbackRegistered = fn !== null
      return original.apply(this, arguments)
    }
  }
}
