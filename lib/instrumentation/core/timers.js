'use strict'

module.exports = initialize

function initialize(agent, timers, moduleName, shim) {
  const processMethods = ['nextTick', '_nextDomainTick', '_tickDomainCallback']

  shim.wrap(
    process,
    processMethods,
    function wrapProcess(shim, fn) {
      return function wrappedProcess() {
        const segment = shim.getActiveSegment()
        if (!segment) {
          return fn.apply(this, arguments)
        }

        // Manual copy because helper methods add significant overhead in some usages
        var len = arguments.length
        var args = new Array(len)
        for (var i = 0; i < len; ++i) {
          args[i] = arguments[i]
        }

        shim.bindSegment(args, shim.FIRST, segment)

        return fn.apply(this, args)
      }
    }
  )

  instrumentTimerMethods(timers)

  // If we need to instrument separate references to timers on the global object,
  // do that now.
  if (!shim.isWrapped(global.setTimeout)) {
    instrumentTimerMethods(global)
  }

  function instrumentTimerMethods(nodule) {
    const asynchronizers = [
      'setTimeout',
      'setInterval'
    ]

    shim.record(nodule, asynchronizers, recordAsynchronizers)

    // We don't want to create segments for setImmediate calls, as the
    // object allocation may incur too much overhead in some situations
    shim.wrap(nodule, 'setImmediate', wrapSetImmediate)

    shim.wrap(nodule, 'clearTimeout', wrapClearTimeout)

    makeWrappedPromisifyCompatible(shim, nodule)
  }

  function wrapSetImmediate(shim, fn) {
    return function wrappedSetImmediate() {
      const args = shim.argsToArray.apply(shim, arguments)
      shim.bindSegment(args, shim.FIRST)

      return fn.apply(this, args)
    }
  }

  function wrapClearTimeout(shim, fn) {
    return function wrappedClearTimeout(timer) {
      if (timer && timer._onTimeout) {
        const segment = timer._onTimeout.__NR_segment
        if (segment) {
          segment.ignore = true
        }
      }

      return fn.apply(this, arguments)
    }
  }

  function recordAsynchronizers(shim, fn, name) {
    return {name: 'timers.' + name, callback: shim.FIRST}
  }
}

function makeWrappedPromisifyCompatible(shim, timers) {
  const originalSetTimout = shim.getOriginal(timers.setTimeout)
  Object.getOwnPropertySymbols(originalSetTimout).forEach((symbol) => {
    timers.setTimeout[symbol] = originalSetTimout[symbol]
  })

  const originalSetInterval = shim.getOriginal(timers.setInterval)
  Object.getOwnPropertySymbols(originalSetInterval).forEach((symbol) => {
    timers.setInterval[symbol] = originalSetInterval[symbol]
  })

  const originalSetImmediate = shim.getOriginal(timers.setImmediate)
  Object.getOwnPropertySymbols(originalSetImmediate).forEach((symbol) => {
    timers.setImmediate[symbol] = originalSetImmediate[symbol]
  })
}
