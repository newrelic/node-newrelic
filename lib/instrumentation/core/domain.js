'use strict'

module.exports = initialize

function initialize(agent, domain, name, shim) {
  var proto = domain.Domain.prototype
  shim.wrap(
    proto,
    'emit',
    wrapEmit
  )

  function wrapEmit(shim, original) {
    return function wrappedEmit(ev) {
      var shouldRestoreContext =
        ev === 'error' &&
        shim.getActiveSegment() === null &&
        shim.getSegment(this)

      if (!shouldRestoreContext) {
        return original.apply(this, arguments)
      }

      shim.setActiveSegment(shim.getSegment(this))
      try {
        return original.apply(this, arguments)
      } finally {
        shim.setActiveSegment(null)
      }
    }
  }
}
