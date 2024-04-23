/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

if (global.structuredClone) {
  module.exports = global.structuredClone
} else {
  module.exports = function sc(input) {
    const result = {}
    for (const [k, v] of Object.entries(input)) {
      if (Array.isArray(v) === true) {
        result[k] = []
        Array.prototype.push.apply(result[k], v)
      } else if (Object.prototype.toString.call(v) === '[object Object]') {
        result[k] = sc(v)
      } else {
        result[k] = v
      }
    }
    return result
  }
}
