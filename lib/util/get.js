/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Local implementation of `lodash.get`.
 *
 * @see https://lodash.com/docs#get
 *
 * @example
 * const obj = { foo: { bar: { baz: [1, 2, 3] } } }
 * let value = get(obj, ['foo', 'bar', 'baz[2]'], -1)
 * console.log(value) // 2
 * value = get(obj, ['foo', 'bar', 'baz[42]'], -1)
 * console.log(value) // -1
 *
 * @param {object} obj The object in which to find the value.
 * @param {string[]|string} keys Either an array of string path parts, or
 * a dot delimited path, e.g. `foo.bar.baz[2]`.
 * @param {*} [defaultVal] The value to return if the routine is unable to
 * find a value at the specified path. The default is `undefined`.
 *
 * @returns {*}
 */
function get(obj, keys, defaultVal) {
  keys = Array.isArray(keys) ? keys : keys.replace(/(\[(\d)\])/g, '.$2').split('.')
  obj = obj[keys[0]]

  if (obj && keys.length > 1) {
    return get(obj, keys.slice(1), defaultVal)
  }

  return obj === undefined ? defaultVal : obj
}

module.exports = get
