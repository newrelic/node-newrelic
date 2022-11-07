/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const symbols = require('../../symbols')

module.exports = initialize

function initialize(agent, timers, moduleName, shim) {
  if (!agent.config.feature_flag.async_local_context) {
    instrumentProcessMethods(shim, process)
  }

  instrumentTimerMethods(timers)

  // If we need to instrument separate references to timers on the global object,
  // do that now.
  if (!shim.isWrapped(global.setTimeout)) {
    instrumentTimerMethods(global)
  }

  function instrumentTimerMethods(nodule) {
    const asynchronizers = ['setTimeout', 'setInterval']

    shim.record(nodule, asynchronizers, recordAsynchronizers)

    if (!agent.config.feature_flag.async_local_context) {
      // We don't want to create segments for setImmediate calls, as the
      // object allocation may incur too much overhead in some situations
      shim.wrap(nodule, 'setImmediate', wrapSetImmediate)
    }

    shim.wrap(nodule, 'clearTimeout', wrapClearTimeout)

    makeWrappedPromisifyCompatible(shim, nodule)
  }

  function wrapSetImmediate(shim, fn) {
    return function wrappedSetImmediate() {
      const segment = shim.getActiveSegment()
      if (!segment) {
        return fn.apply(this, arguments)
      }

      const args = shim.argsToArray.apply(shim, arguments, segment)
      shim.bindSegment(args, shim.FIRST)

      return fn.apply(this, args)
    }
  }

  function wrapClearTimeout(shim, fn) {
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

  function recordAsynchronizers(shim, fn, name) {
    return { name: 'timers.' + name, callback: shim.FIRST }
  }
}

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

function makeWrappedPromisifyCompatible(shim, timers) {
  const originalSetTimeout = shim.getOriginal(timers.setTimeout)
  Object.getOwnPropertySymbols(originalSetTimeout).forEach((symbol) => {
    timers.setTimeout[symbol] = originalSetTimeout[symbol]
  })

  const originalSetInterval = shim.getOriginal(timers.setInterval)
  Object.getOwnPropertySymbols(originalSetInterval).forEach((symbol) => {
    timers.setInterval[symbol] = originalSetInterval[symbol]
  })

  if (!shim.agent.config.feature_flag.async_local_context) {
    const originalSetImmediate = shim.getOriginal(timers.setImmediate)
    Object.getOwnPropertySymbols(originalSetImmediate).forEach((symbol) => {
      timers.setImmediate[symbol] = originalSetImmediate[symbol]
    })
  }
}
