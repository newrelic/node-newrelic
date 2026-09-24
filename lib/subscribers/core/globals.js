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
 * tracing channels; it only patches `process.emit` so the errors get reported.
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

    // `emit` is wrapped rather than listened to: registering a listener for either
    //  event changes what Node does with the error -- an `uncaughtException`
    //  listener stops the process from crashing, and an `unhandledRejection`
    //  listener suppresses the default escalation.
    shimmer.wrapMethod(globals, 'globals', 'emit', function wrapEmit(original) {
      // `promise` only holds a promise for `unhandledRejection`. For
      // `uncaughtException` Node passes the origin string in that position,
      // which we do not read.
      return function wrappedEmit(eventName, error, promise) {
        // Node emits `uncaughtException` only when neither an uncaught
        // exception capture callback nor a domain is handling the error -- see
        // `createOnGlobalUncaughtException` in
        // node/lib/internal/process/execution.js, where those two cases take
        // the other branches and never reach this emit. So there is nothing
        // extra to check for here. In serverless mode this is handled by its
        // own `_fatalException` wrapper.
        //
        // An unhandled rejection that escalates arrives here a second time as
        // `uncaughtException`, and under `--unhandled-rejections=strict` it
        // arrives here *only* that way, so it must not be filtered out by
        // origin. The duplicate is dropped by the error collector, which
        // ignores an error instance it has already seen.
        if (eventName === 'uncaughtException' && agent.serverlessMode === false) {
          agent.errors.add(null, error)
        }

        // Check for unhandledRejections here so we don't change the behavior of
        // the event.
        if (
          eventName === 'unhandledRejection' &&
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
  }
}

module.exports = GlobalsSubscriber
