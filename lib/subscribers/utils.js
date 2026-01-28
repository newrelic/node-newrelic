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
 * OpenAI has a [custom promise](https://github.com/openai/openai-node/blob/master/src/core/api-promise.ts).
 * ioredis has broken the promise chain and uses this instead, [see](https://github.com/redis/ioredis/blob/d5f5b407bd1287fd86d2ca5df7a10c50c9702305/lib/Pipeline.ts#L218)
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

  promise.then((result) => {
    data.result = result
    this.channel.asyncEnd.publish(data)
  }, (err) => {
    data.error = err
    this.channel.asyncEnd.publish(data)
  })
}

module.exports = {
  wrapPromise
}
