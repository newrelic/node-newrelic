'use strict'

var wrap = require('../../shimmer').wrapMethod

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
        const args = shim.argsToArray.apply(shim, arguments)
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

  const originalSetTimout = shim.getOriginal(timers.setTimeout)
  Object.getOwnPropertySymbols(originalSetTimout).forEach((symbol) => {
    timers.setTimeout[symbol] = originalSetTimout[symbol]
  })

  const originalSetInterval = shim.getOriginal(timers.setInterval)
  Object.getOwnPropertySymbols(originalSetInterval).forEach((symbol) => {
    timers.setInterval[symbol] = originalSetInterval[symbol]
  })

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

  const originalSetImmediate = shim.getOriginal(timers.setImmediate)
  Object.getOwnPropertySymbols(originalSetImmediate).forEach((symbol) => {
    timers.setImmediate[symbol] = originalSetImmediate[symbol]
  })

  var clearTimeouts = ['clearTimeout']

  wrap(timers, 'timers', clearTimeouts, function wrapClear(original) {
    return function wrappedClear(timer) {
      var segment
      if (timer && timer._onTimeout) {
        segment = agent.tracer.getSegmentFromWrapped(timer._onTimeout)
        timer._onTimeout = agent.tracer.getOriginal(timer._onTimeout)
      }

      if (timer && timer._onImmediate) {
        timer._onImmediate = agent.tracer.getOriginal(timer._onImmediate)
      }

      if (segment) segment.ignore = true

      return original.apply(this, arguments)
    }
  })
}
