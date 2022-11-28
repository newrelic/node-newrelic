/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')

module.exports = function exports(a, b) {
  /*
   * NaN is a special case, util.isDeepStrictEqual will return true for comparing two NaNs,
   * but comparing a NaN to itself like this returns false (yay for weird JS stuff)
   *
   * Added this special check because the original implementation of this
   * did not consider two NaNs as equal, so preserving existing functionality
   */
  if (a !== a && b !== b) {
    return false
  }

  return util.isDeepStrictEqual(a, b)
}
