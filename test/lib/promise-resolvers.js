/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Implements https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers
 *
 * This can be removed once Node.js v22 is the minimum.
 *
 * @returns {{resolve, reject, promise: Promise<unknown>}}
 */
module.exports = function promiseResolvers() {
  if (typeof Promise.withResolvers === 'function') {
    // Node.js >=22 natively supports this.
    return Promise.withResolvers()
  }

  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}
