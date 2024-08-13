/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { RecorderSpec } = require('../../shim/specs')
const symbols = require('../../symbols')
const Timers = require('timers')

module.exports = initialize

function initialize(_agent, timers, _moduleName, shim) {
  instrumentTimerMethods(shim, [timers, global])
}

/**
 * Sets up instrumentation for setTimeout, setInterval and clearTimeout
 * on timers and global.
 *
 * @param {Shim} shim instance of shim
 * @param {Array<Timers,global>} pkgs array with references to timers and global
 */
function instrumentTimerMethods(shim, pkgs) {
  pkgs.forEach((nodule) => {
    if (shim.isWrapped(nodule.setTimeout)) {
      return
    }

    const asynchronizers = ['setTimeout', 'setInterval']
    shim.record(nodule, asynchronizers, recordAsynchronizers)
    shim.wrap(nodule, 'clearTimeout', wrapClearTimeout)
    makeWrappedPromisifyCompatible(shim, nodule)
  })
}

/**
 * Ignores the segment when clearTimeout is called
 *
 * @param {Shim} _shim instance of shim
 * @param {Function} fn clearTimeout
 * @returns {Function} wrapped clearTimeout
 */
function wrapClearTimeout(_shim, fn) {
  return function wrappedClearTimeout(timer) {
    if (timer && timer._onTimeout) {
      const segment = timer._onTimeout[symbols.segment]
      if (segment && !segment.opaque) {
        segment.ignore = true
      }
    }

    return fn.apply(this, arguments)
  }
}

/**
 * Defines the spec for setTimeout and setInterval
 *
 * @param {Shim} shim instance of shim
 * @param {Function} _fn original function
 * @param {string} name name of function
 * @returns {object} spec defining how to instrument
 */
function recordAsynchronizers(shim, _fn, name) {
  return new RecorderSpec({ name: 'timers.' + name, callback: shim.FIRST })
}

/**
 * Copies the symbols from original setTimeout and setInterval onto the wrapped functions
 *
 * @param {Shim} shim instance of shim
 * @param {Timers} nodule Timers class
 */
function makeWrappedPromisifyCompatible(shim, nodule) {
  copySymbols(shim, nodule, 'setTimeout')
  copySymbols(shim, nodule, 'setInterval')
}

/**
 * Helper to copy symbols from original function to wrapped one
 *
 * @param {Shim} shim instance of shim
 * @param {Timers} nodule Timers class
 * @param {string} name name of function
 */
function copySymbols(shim, nodule, name) {
  const originalFunction = shim.getOriginal(nodule[name])
  Object.getOwnPropertySymbols(originalFunction).forEach((symbol) => {
    nodule[name][symbol] = originalFunction[symbol]
  })
}
