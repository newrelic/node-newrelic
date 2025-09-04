/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'code-level-metrics' })
const { isValidLength } = require('./byte-limit')
const symbols = require('../symbols')
const clmUtils = module.exports

/**
 * Attaches a flag on function indicating that
 * CLM attributes need to be associated with it.
 *
 * Note: director middleware instrumentation passes in a string as the "function" so we have to check if the function is actually a function
 * to avoid crashing, abstraction not FTW
 *
 * @param {Shim} shim instance of shim
 * @param {Function} fn function to apply clm symbol
 */
clmUtils.assignCLMSymbol = function assignCLMSymbol(shim, fn) {
  if (shim.isFunction(fn) && shim.agent.config.code_level_metrics.enabled) {
    fn[symbols.clm] = true
  }
}

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
clmUtils.addCLMAttributes = function addCLMAttributes(fn, segment) {
  if (!fn[symbols.clm]) {
    return
  }

  try {
    const { funcInfo } = require('@contrast/fn-inspect')
    const { lineNumber, method, file: filePath, column } = funcInfo(fn)
    const fnName = setFunctionName(method)

    if (isValidLength(fnName, 255) && filePath && isValidLength(filePath, 255)) {
      segment.addAttribute('code.filepath', filePath)
      segment.addAttribute('code.function', fnName)
      // both line numbers and columns start at 0 in v8, add 1 to reflect js code
      // See: https://v8.github.io/api/head/classv8_1_1Function.html#a87bc63f97a9a39f83051570519fc63c2
      segment.addAttribute('code.lineno', lineNumber + 1)
      segment.addAttribute('code.column', column + 1)
    }
  } catch (err) {
    logger.infoOnce(
      'clm:function-inspector',
      { err },
      'Not using v8 function inspector, falling back to function name'
    )
    const fnName = setFunctionName(fn.name)

    if (isValidLength(fnName, 255)) {
      segment.addAttribute('code.function', fnName)
    }
  }
}
