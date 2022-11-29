/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'code-level-metrics' })

/**
 * Helper to retrieve Code Level Metrics(CLM)
 * properties from a function reference.
 *
 * @param {Function} fn function reference
 * @returns {object} CLM properties
 */
module.exports = function getCLMMeta(fn) {
  try {
    const { funcInfo } = require('@contrast/fn-inspect')
    const fnMeta = funcInfo(fn)
    return {
      'code.filepath': fnMeta.file,
      'code.function': fnMeta.method || 'anonymous',
      'code.lineno': fnMeta.lineNumber + 1 // line numbers start at 0 in v8 so we have to add 1 to reflect js code
    }
  } catch (err) {
    logger.info({ err }, 'Not using v8 function inspector, falling back to function name')
    return {
      'code.function': fn.name || 'anonymous'
    }
  }
}
