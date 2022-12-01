/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'code-level-metrics' })
const { isValidLength } = require('./byte-limit')
const symbols = require('../symbols')

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
 * Helper used to assign Code Level Metrics(CLM)
 * to an active segment.
 *
 * spec states if function or filepath are > 255, do not assign
 * CLM attrs
 *
 * @param {Function} fn function reference
 * @param {TraceSegment} segment active segment to attach code.* attrs
 */
module.exports = function addCLMAttributes(fn, segment) {
  if (!fn[symbols.clm]) {
    return
  }

  try {
    const { funcInfo } = require('@contrast/fn-inspect')
    const { lineNumber, method, file: filePath, column } = funcInfo(fn)
    const fnName = setFunctionName(method)

    if (isValidLength(fnName, 255) && isValidLength(filePath, 255)) {
      segment.addAttribute('code.filepath', filePath)
      segment.addAttribute('code.function', fnName)
      // both line numbers and columns start at 0 in v8, add 1 to reflect js code
      // See: https://v8.github.io/api/head/classv8_1_1Function.html#a87bc63f97a9a39f83051570519fc63c2
      segment.addAttribute('code.lineno', lineNumber + 1)
      segment.addAttribute('code.column', column + 1)
    }
  } catch (err) {
    logger.infoOnce({ err }, 'Not using v8 function inspector, falling back to function name')
    const fnName = setFunctionName(fn.name)

    if (isValidLength(fnName, 255)) {
      segment.addAttribute('code.function', fnName)
    }
  }
}
