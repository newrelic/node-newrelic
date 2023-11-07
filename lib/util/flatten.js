/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

exports = module.exports = flatten
exports.keys = flatKeys

/**
 * Flatten nested maps of JSONifiable data.
 *
 * Ex: {a: 5, b: {c: true, d: 7}} -> {a: 5, 'b.c': true, 'b.d': 7}
 *
 * @private
 * @param {object} result Object to place key-value pairs into, normally called with `{}`.
 * @param {string} prefix Prefix for keys, normally called with `''`.
 * @param seen
 * @param {object} obj    Object to be flattened.
 * @returns {object} Object with flattened key-value pairs
 */
function flatten(result, prefix, obj, seen) {
  seen = seen || []
  seen.push(obj)

  for (const key in obj) {
    if (seen.indexOf(obj[key]) > -1) {
      continue
    }

    if (obj[key] instanceof Object) {
      flatten(result, prefix + key + '.', obj[key], seen)
    } else {
      result[prefix + key] = obj[key]
    }
  }

  return result
}

/**
 * Retrieves all the keys that would exist in the flattened version of the object.
 *
 * @private
 * @param {object}  obj       - The object to get the flat keys of.
 * @param {string}  prefix    - A prefix for the keys, usually `''`.
 * @param arrayIdxs
 * @param {boolean}    arrayIdx  - Flag indicating if array indexes should be iterated.
 * @returns {Array.<string>} An array of keys names.
 */
function flatKeys(obj, prefix, arrayIdxs) {
  const keys = []
  const seen = []
  recurse(prefix || '', obj)
  return keys

  function recurse(p, o) {
    seen.push(o)

    for (const key in o) {
      if (seen.indexOf(o[key]) !== -1) {
        continue
      }

      if (o[key] instanceof Object && (arrayIdxs || !Array.isArray(o[key]))) {
        recurse(p + key + '.', o[key])
      } else {
        keys.push(p + key)
      }
    }
  }
}
