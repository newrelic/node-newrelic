/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Utility method to remove a set of modules from the require cache.
 *
 * @param {string[]} modules The set of module names to remove from the cache.
 */
module.exports = {
  /**
   * Removes explicitly named modules from the require cache.
   *
   * @param {string[]} modules
   *
   * @returns {number} The number of cache entries removed.
   */
  removeModules(modules = []) {
    let removed = 0
    const keys = Object.keys(require.cache)
    for (const mod of modules) {
      for (const key of keys) {
        if (key.includes(mod) === false) {
          continue
        }
        delete require.cache[key]
        removed += 1
      }
    }
    return removed
  },

  /**
   * Removes modules from the require cache that are identified by a matcher.
   *
   * @param {RegExp} matcher
   *
   * @returns {number} The number of cache entries removed.
   */
  removeMatchedModules(matcher) {
    let removed = 0
    const keys = Object.keys(require.cache)
    for (const key of keys) {
      if (matcher.test(key) === false) {
        continue
      }
      delete require.cache[key]
      removed += 1
    }
    return removed
  }
}
