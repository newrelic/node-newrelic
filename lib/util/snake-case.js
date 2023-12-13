/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
// lodash ripoff: https://github.com/Tcdian/Lodash/blob/master/source/string/words.ts
const wordPattern = new RegExp(
  ['[A-Z][a-z]+', '[A-Z]+(?=[A-Z][a-z])', '[A-Z]+', '[a-z]+', '[0-9]+'].join('|'),
  'g'
)
const words = (string) => string.match(wordPattern) || []

/**
 * Converts a string to snake_case
 *
 * @param {string} string value to convert to snake case
 * @returns {string} snake cased string
 */

module.exports = function toSnakeCase(string) {
  return words(string)
    .map((word) => word.toLowerCase())
    .join('_')
}
