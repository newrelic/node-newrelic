/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = description

/**
 * Tagged template to make writing long schema descriptions a little easier.
 * It trims leading and trailing whitespace, and replaces single newlines with
 * a space.
 *
 * @param {string[]} strings The template to parse.
 *
 * @returns {string} The normalized description string.
 */
function description(strings) {
  return strings[0].trim().replaceAll(
    /(\w)(\n)(\w)/g,
    '$1 $3'
  )
}
