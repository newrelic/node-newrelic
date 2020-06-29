/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// A simplified implementation of lodash.get
// see: https://www.npmjs.com/package/lodash.get
function get(obj, keys, defaultVal) {
  keys = Array.isArray(keys) ? keys : keys.replace(/(\[(\d)\])/g, '.$2').split('.')
  obj = obj[keys[0]]

  if (obj && keys.length > 1) {
    return get(obj, keys.slice(1), defaultVal)
  }

  return obj === undefined ? defaultVal : obj
}

module.exports = get
