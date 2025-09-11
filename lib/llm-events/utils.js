/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// value is valid when it's greater than 0 or not null
function validCallbackTokenValue(tokenValue) {
  return tokenValue > 0 || !tokenValue
}

module.exports = {
  validCallbackTokenValue
}
