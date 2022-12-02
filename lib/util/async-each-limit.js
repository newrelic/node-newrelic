/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Helper method for limiting number of concurrent async executions to a certain limit
 * Native replacement for async.eachLimit, fixes https://issues.newrelic.com/browse/NR-69739
 *
 * Shamelessly ripped off from https://github.com/nodejs/help/issues/2192#issuecomment-533730280
 * and https://timtech.blog/posts/limiting-async-operations-promise-concurrency-javascript/
 *
 * @param {Array} items Array to iterate over
 * @param {Function} fn the callback from Array.map you would normally write that contains an async operation
 * @param {number} limit the maximum allowed concurrent invocations of `fn`
 */
async function eachLimit(items, fn, limit) {
  const results = []

  while (items.length) {
    const resolved = await Promise.all(items.splice(0, limit).map(fn))
    results.push(...resolved)
  }

  return results
}

module.exports = eachLimit
