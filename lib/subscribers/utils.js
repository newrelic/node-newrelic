/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/**
 * Temporary fix as `tracePromise` wraps the promise in a native one.
 * We are now wrapping all openai functions in a `traceSync` call.
 * Then we attach resolve/rejection handlers to indicate a promise is finished.
 * We are not re-throwing the error because that would create an unhandled promise rejection, since the error is getting handled in openai code.
 * OpenAI has a [custom promise](https://github.com/openai/openai-node/blob/master/src/core/api-promise.ts).
 * see: https://github.com/newrelic/node-newrelic/issues/3379
 * see: https://github.com/nodejs/node/issues/59936
 * @param {object} data the data associated with the `end` event
 * @returns {Promise|void} If not a thenable then returns the "promise", otherwise wraps promise in tracing channel methods
 */
function wrapPromise(data) {
  const promise = data?.result
  if (typeof promise.then !== 'function') {
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
