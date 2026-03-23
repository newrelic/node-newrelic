/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseSubscriber = require('../base')

module.exports = class BluebirdPromiseSubscriber extends BaseSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_then', packageName: 'bluebird' })
  }

  /**
   * We have to wrap the Promise prototype, not just the _then method.
   * This is because we need to get the current context from when the promise was constructed.
   * If we only wrapped `_then`, the context is not the same, you can see from the versioned tests
   * Where it will defer promise resolution
   *
   * @param {object} data event data
   * @param {Context} ctx the current context
   * @returns {Context} in this case it is the same context, just with both `_then` and its respective callbacks bound to the current context
   */
  handler(data, ctx) {
    const { self: BluebirdPromise } = data
    const origThen = BluebirdPromise._then
    BluebirdPromise._then = this.#wrapThenHandler({ ctx, origThen })
    return ctx
  }

  /**
   * wraps the current `_then` method on the instance.
   * It binds the context from when promise was constructed to the callbacks(didFulfill, didReject, didProgress)
   *
   * @param {object} params to function
   * @param {Context} params.ctx active context
   * @param {Function} params.origThen the original `_then` method on promise instance
   * @returns {Function} wrapped `_then` function
   */
  #wrapThenHandler({ ctx, origThen }) {
    const self = this
    return function wrappedThenHandler(...args) {
      const [didFulfill, didReject, didProgress] = args
      // only bind the callback if the transaction from context is still active
      if (ctx.transaction.isActive() === false) {
        return origThen.apply(this, args)
      }
      args[0] = self.agent.tracer.bindFunction(didFulfill, ctx)
      args[1] = self.agent.tracer.bindFunction(didReject, ctx)

      // didProgress is only applicable to v2.x
      if (didProgress) {
        args[2] = self.agent.tracer.bindFunction(didProgress, ctx)
      }
      return self.agent.tracer.bindFunction(origThen, ctx).apply(this, args)
    }
  }
}
