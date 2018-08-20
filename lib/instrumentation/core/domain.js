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
      var shouldRestoreContext = ev === 'error' &&
          shim.getActiveSegment() === null &&
          this.__NR_transactionSegment
      if (!shouldRestoreContext) {
        return original.apply(this, arguments)
      }

      shim.setActiveSegment(this.__NR_transactionSegment)
      try {
        return original.apply(this, arguments)
      } finally {
        shim.setActiveSegment(null)
        this.__NR_transactionSegment = null
      }
    }
  }
}
