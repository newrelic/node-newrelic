'use strict'

module.exports = initialize

function initialize(agent, timers, moduleName, shim) {
  // As of iojs 1.6.3 all timers are on the global object, and do
  // not need a require('timers') call to access them
  if (timers !== global && !shim.isWrapped(global.setTimeout)) {
    initialize(agent, global, moduleName, shim)
  }

  const processMethods = ['nextTick', '_nextDomainTick', '_tickDomainCallback']

  shim.wrap(
    process,
    processMethods,
    function wrapProcess(shim, fn) {
      return function wrappedProcess() {
        if (!shim.getActiveSegment()) {
          return fn.apply(this, arguments)
        }

        // Manual copy because helper methods add significant overhead in some usages
        var len = arguments.length
        var args = new Array(len)
        for (var i = 0; i < len; ++i) {
          args[i] = arguments[i]
        }

        shim.bindSegment(args, shim.FIRST)

        return fn.apply(this, args)
      }
    }
  )

  const asynchronizers = [
    'setTimeout',
    'setInterval'
  ]

  shim.record(
    timers,
    asynchronizers,
    function recordAsynchronizers(shim, fn, name) {
      return {name: 'timers.' + name, callback: shim.FIRST}
    }
  )

  // We don't want to create segments for setImmediate calls, as the
  // object allocation may incur too much overhead in some situations
  shim.wrap(
    timers,
    'setImmediate',
    function wrapSetImmediate(shim, fn) {
      return function wrappedSetImmediate() {
        const args = shim.argsToArray.apply(shim, arguments)
        shim.bindSegment(args, shim.FIRST)

        return fn.apply(this, args)
      }
    }
  )

  shim.wrap(
    timers,
    'clearTimeout',
    function wrapClearTimeout(shim, fn) {
      return function wrappedClearTimeout(timer) {
        var segment
        if (timer && timer._onTimeout) {
          segment = shim.getSegment(timer._onTimeout)
          timer._onTimeout = shim.getOriginal(timer._onTimeout)
        }

        if (timer && timer._onImmediate) {
          timer.onImmediate = shim.getOriginal(timer._onImmediate)
        }

        if (segment) {
          segment.ignore = true
        }

        return fn.apply(this, arguments)
      }
    }
  )

  makeWrappedPromisifyCompatible(shim, timers)
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
