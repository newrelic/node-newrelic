/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const hasOwnProperty = require('./properties').hasOwn

exports.shallow = shallowCopy

/**
 * Performs a shallow copy of all properties on the source object.
 *
 * @param {object} source     - The object to copy the properties from.
 * @param {object} [dest={}]  - The object to copy the properties to.
 * @returns {object} The destination object.
 */
function shallowCopy(source, dest) {
  dest = dest || Object.create(null)
  for (const k in source) {
    if (hasOwnProperty(source, k)) {
      dest[k] = source[k]
    }
  }
  return dest
}
