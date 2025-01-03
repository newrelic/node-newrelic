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
  // We are disabling this lint rule because it complains about
  // `withResolvers` not being available until Node 22. We know that.
  // We are doing feature detection.
  /* eslint-disable n/no-unsupported-features/es-syntax */
  if (typeof Promise.withResolvers === 'function') {
    // Node.js >=22 natively supports this.
    return Promise.withResolvers()
  }
  /* eslint-enable n/no-unsupported-features/es-syntax */

  let resolve
  let reject
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}
