/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'code-level-metrics' })
const { isValidLength } = require('./byte-limit')

/**
 * Uses function name if truthy
 * otherwise it defaults to (anonymous)
 *
 * @param {string} name name of function
 * @returns {string} function name or (anonymous)
 */
function setFunctionName(name) {
  return name || '(anonymous)'
}

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
    const { lineNumber, method, file: filePath } = funcInfo(fn)
    const fnName = setFunctionName(method)

    if (isValidLength(fnName, 255) && isValidLength(filePath, 255)) {
      return {
        'code.filepath': filePath,
        'code.function': fnName,
        'code.lineno': lineNumber + 1 // line numbers start at 0 in v8 so we have to add 1 to reflect js code
      }
    }
  } catch (err) {
    logger.infoOnce({ err }, 'Not using v8 function inspector, falling back to function name')
    const fnName = setFunctionName(fn.name)

    if (isValidLength(fnName, 255)) {
      return {
        'code.function': fnName
      }
    }
  }
}
