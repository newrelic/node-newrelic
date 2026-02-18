/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const stringifySafe = require('json-stringify-safe')

/**
 * Utility to stringify an object.
 * This should always be used within the agent.
 * It will attempt to `JSON.stringify` and if it fails, due to circular references,
 * it will use `json-stringify-safe`. We don't always want to use this due to its performance
 *
 * @param {object} obj The object to convert to a JSON string.
 * @param {Function | Array | null} replacer A function that alters the behavior of the stringification process, or an array of strings and numbers that specifies properties of value to be included in the output.
 * @param {string|number} space A string or number that's used to insert white space (including indentation, line break characters, etc.) into the output JSON string for readability purposes.
 * @returns {string|undefined} stringified version of object
 */
function stringify(obj, replacer, space) {
  try {
    return JSON.stringify(obj, replacer, space)
  } catch {
    return stringifySafe(obj, replacer, space)
  }
}

module.exports = stringify
