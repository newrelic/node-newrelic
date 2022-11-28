/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Helper to retrive Code Level Metrics(CLM)
 * properties from a function reference.
 *
 * Currently this only will return code.function,
 * more will be added later behind a feature flag
 *
 * @param {Function} fn function reference
 * @returns {object} CLM properties
 */
module.exports = function getCLMMeta(fn) {
  return {
    'code.function': fn?.name || 'anonymous'
  }
}
