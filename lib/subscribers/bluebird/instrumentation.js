/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseSubscriber = require('../base')
const { wrapMethod } = require('../wrap-method.js')
const symbols = require('#agentlib/symbols.js')

module.exports = class BluebirdPromiseSubscriber extends BaseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_then', packageName: 'bluebird' })
  }

  /**
   * Stores the active ctx on bluebird promise,
   * then wraps `Promise.prototype._then` once so every bluebird promise shares a single wrapped method
   * instead of each construction allocating its own wrapper and closure.
   *
   * The stashed context is what lets the shared `_then` keep binding
   * callbacks to the context from when a given promise was constructed,
   * even though the wrapper itself can no longer close over it.
   *
   * @param {object} data event data
   * @param {Context} ctx the current context
   * @returns {Context} the same context passed in
   */
  handler(data, ctx) {
    const { self: promise } = data
    promise[symbols.context] = ctx

    wrapMethod({
      module: Object.getPrototypeOf(promise),
      methodName: '_then',
      logger: this.logger,
      wrapper: this.#wrapThenHandler.bind(this)
    })

    return ctx
  }

  /**
   * Wraps `_then` once on the bluebird `Promise` prototype.
   * It binds the context from when the promise was constructed to the callbacks(didFulfill, didReject)
   *
   * @param {Function} origThen the original `_then` method on the promise prototype
   * @returns {Function} wrapped `_then` function
   */
  #wrapThenHandler(origThen) {
    const self = this
    return function wrappedThenHandler(...args) {
      const ctx = this[symbols.context]
      const [didFulfill, didReject] = args
      // only bind the callback if the context is present and the transaction from it is still active
      if (!ctx || ctx.transaction.isActive() === false) {
        return origThen.apply(this, args)
      }
      args[0] = self.agent.tracer.bindFunction(didFulfill, ctx)
      args[1] = self.agent.tracer.bindFunction(didReject, ctx)

      return self.agent.tracer.runInContext({ handler: origThen, context: ctx, thisArg: this, args })
    }
  }
}
