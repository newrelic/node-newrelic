/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const symbols = require('../../symbols')
const Timers = require('timers')

module.exports = initialize

function initialize(agent, timers, _moduleName, shim) {
  const isLegacyContext = agent.config.feature_flag.legacy_context_manager

  if (isLegacyContext) {
    instrumentProcessMethods(shim, process)
    instrumentSetImmediate(shim, [timers, global])
  }

  instrumentTimerMethods(shim, [timers, global])
}

/**
 * Sets up instrumentation for setImmediate on both timers and global.
 *
 * We do not want to create segments for setImmediate calls,
 * as the object allocation may incur too much overhead in some situations
 *
 * @param {Shim} shim instance of shim
 * @param {Array<Timers,global>} pkgs array with references to timers and global
 */
function instrumentSetImmediate(shim, pkgs) {
  pkgs.forEach((nodule) => {
    if (shim.isWrapped(nodule.setImmediate)) {
      return
    }

    shim.wrap(nodule, 'setImmediate', function wrapSetImmediate(shim, fn) {
      return function wrappedSetImmediate() {
        const segment = shim.getActiveSegment()
        if (!segment) {
          return fn.apply(this, arguments)
        }

        const args = shim.argsToArray.apply(shim, arguments, segment)
        shim.bindSegment(args, shim.FIRST)

        return fn.apply(this, args)
      }
    })

    copySymbols(shim, nodule, 'setImmediate')
  })
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
  return { name: 'timers.' + name, callback: shim.FIRST }
}

/**
 * Instruments core process methods: nextTick, _nextDomainTick, _tickDomainCallback
 * Note: This does not get registered when the context manager is async local
 *
 * @param {Shim} shim instance of shim
 * @param {process} process global process object
 */
function instrumentProcessMethods(shim, process) {
  const processMethods = ['nextTick', '_nextDomainTick', '_tickDomainCallback']

  shim.wrap(process, processMethods, function wrapProcess(shim, fn) {
    return function wrappedProcess() {
      const segment = shim.getActiveSegment()
      if (!segment) {
        return fn.apply(this, arguments)
      }

      // Manual copy because helper methods add significant overhead in some usages
      const len = arguments.length
      const args = new Array(len)
      for (let i = 0; i < len; ++i) {
        args[i] = arguments[i]
      }

      shim.bindSegment(args, shim.FIRST, segment)

      return fn.apply(this, args)
    }
  })
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
