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
 * Converts a string to camelCase
 *
 * @param {string} string value to convert to camel case
 * @returns {string} camel cased string
 */
module.exports = function toCamelCase(string) {
  return words(string)
    .map((word, index) => (index === 0 ? word.toLowerCase() : word.slice(0, 1).toUpperCase() + word.slice(1)))
    .join('')
}
