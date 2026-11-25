/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../logger').child({ component: 'code-level-metrics' })
const { isValidLength } = require('./byte-limit')
const symbols = require('../symbols')
const clmUtils = module.exports

// `undefined` until the first load attempt, `null` if the inspector is unavailable.
// Resolved once because `addCLMAttributes` runs on every instrumented function call,
// and a per-call `require` goes through require-in-the-middle (and re-scans the
// filesystem on every call when the native addon fails to load).
let fnInspector

// A function's source location never changes, so inspect each function once.
const clmCache = new WeakMap()

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
 * Loads the v8 function inspector on first use and caches the outcome,
 * including a failure to load.
 *
 * @returns {object|null} The function inspector module, or null if it could not be loaded.
 */
function getFnInspector() {
  if (fnInspector !== undefined) return fnInspector

  try {
    fnInspector = require('@newrelic/fn-inspect')
  } catch (err) {
    fnInspector = null
    logger.infoOnce(
      'clm:function-inspector',
      { err },
      'Not using v8 function inspector, falling back to function name'
    )
  }

  return fnInspector
}

/**
 * Adds only `code.function`, used when source location is unavailable.
 *
 * @param {Function} fn The function reference.
 * @param {TraceSegment} segment The segment to attach the attribute to.
 */
function addFunctionNameOnly(fn, segment) {
  const fnName = setFunctionName(fn.name)

  if (isValidLength(fnName, 255)) {
    segment.addAttribute('code.function', fnName)
  }
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

  const inspector = getFnInspector()
  if (!inspector) {
    addFunctionNameOnly(fn, segment)
    return
  }

  try {
    let info = clmCache.get(fn)
    if (info === undefined) {
      const { lineNumber, method, file: filePath, column } = inspector.funcInfo(fn)
      const fnName = setFunctionName(method)
      const valid = isValidLength(fnName, 255) && filePath && isValidLength(filePath, 255)
      // both line numbers and columns start at 0 in v8, add 1 to reflect js code
      // See: https://v8.github.io/api/head/classv8_1_1Function.html#a87bc63f97a9a39f83051570519fc63c2
      info = valid ? { filePath, fnName, lineno: lineNumber + 1, column: column + 1 } : null
      clmCache.set(fn, info)
    }

    if (info !== null) {
      segment.addAttribute('code.filepath', info.filePath)
      segment.addAttribute('code.function', info.fnName)
      segment.addAttribute('code.lineno', info.lineno)
      segment.addAttribute('code.column', info.column)
    }
  } catch (err) {
    logger.infoOnce(
      'clm:function-inspector',
      { err },
      'Not using v8 function inspector, falling back to function name'
    )
    addFunctionNameOnly(fn, segment)
  }
}
