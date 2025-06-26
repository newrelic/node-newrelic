/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Given the JSON representation of a transaction's trace, reduce it to
 * a tree of named segments.
 * @param {object} traceJSON An array based tree representation of a trace.
 * Use `transaction.trace.toJSON()` to get said tree.
 * @param {object} [options]
 * @param {boolean} [options.excludeRoot] Indicates if the root segment
 * name should be excluded.
 *
 * @returns {*[]}
 */
module.exports = function traceToSegmentTree(traceJSON, { excludeRoot = true } = {}) {
  const filtered = []
  for (const ele of traceJSON) {
    if (typeof ele === 'string') {
      if (ele === 'ROOT' && excludeRoot === true) continue
      filtered.push(ele)
      continue
    }

    if (Array.isArray(ele) === true) {
      const toAdd = traceToSegmentTree(ele, { excludeRoot })
      filtered.push(toAdd)
    }
  }
  return filtered
}
