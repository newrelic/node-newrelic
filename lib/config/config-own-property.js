/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = configOwnProperty

/**
 * Determines if the `key` is an "own" property of the provided object.
 * The `Object.hasOwn` method considers properties exposed by prototype
 * getter methods as not "own" properties. We need to consider such properties
 * as own properties, so we have to a little more work.
 *
 * @param {object} obj The object whose prototype is inspected.
 * @param {string} key The property name to test.
 *
 * @returns {boolean} True when `key` is a prototype accessor.
 */
function configOwnProperty(obj, key) {
  if (Object.hasOwn(obj, key) === true) return true

  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(obj),
    key
  )
  return (
    descriptor != null &&
    (
      typeof descriptor.get === 'function' ||
      typeof descriptor.set === 'function'
    )
  )
}
