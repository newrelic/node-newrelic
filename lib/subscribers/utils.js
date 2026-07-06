/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Temporary fix as `tracePromise` wraps the promise in a native one.
 * Certain 3rd party library functions are wrapped in a `traceSync` call,
 * and use this utility to wrap the promise.
 * Then we attach resolve/rejection handlers to indicate a promise is finished.
 * We are not re-throwing the error because that would create an unhandled promise rejection, since the error is getting handled in 3rd party code.
 * ioredis has broken the promise chain and uses this instead, [see](https://github.com/redis/ioredis/blob/d5f5b407bd1287fd86d2ca5df7a10c50c9702305/lib/Pipeline.ts#L218)
 *
 * The promise is registered out of context and holds the context weakly so an
 * application that never awaits the command promise to completion cannot retain
 * the transaction (see issue #4092) and cause a leak. `asyncEnd` reads the active context to find
 * the segment, so we re-establish the captured context while publishing. If the
 * context has been collected by the time the promise settles there is nothing
 * left to touch.
 *
 * see: https://github.com/newrelic/node-newrelic/issues/3379
 * see: https://github.com/nodejs/node/issues/59936
 * @param {object} data the data associated with the `end` event
 * @returns {Promise|void} If not a thenable then returns the "promise", otherwise wraps promise in tracing channel methods
 */
function wrapPromise(data) {
  const promise = data?.result
  if (typeof promise?.then !== 'function') {
    return promise
  }

  const tracer = this.agent.tracer
  const ctxRef = new WeakRef(tracer.getContext())
  const publishAsyncEnd = () => {
    const ctx = ctxRef.deref()
    if (!ctx) {
      return
    }
    tracer._contextManager.runInContext(ctx, () => {
      this.channel.asyncEnd.publish(data)
    })
  }

  tracer._contextManager.runOutOfContext(() => promise.then((result) => {
    data.result = result
    publishAsyncEnd()
  }, (err) => {
    data.error = err
    publishAsyncEnd()
  }))
}

module.exports = {
  wrapPromise
}
