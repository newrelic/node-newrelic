/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Determines if the provided token count is valid.
 * A valid token count is greater than 0 and not null.
 * @param {number} tokenCount The token count obtained from the token callback
 * @returns {boolean} Whether the token count is valid
 */
function validCallbackTokenCount(tokenCount) {
  return tokenCount > 0 || !tokenCount
}

module.exports = {
  validCallbackTokenCount
}
