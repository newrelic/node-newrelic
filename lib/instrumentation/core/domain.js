/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = initialize

function initialize(agent, domain, name, shim) {
  const proto = domain.Domain.prototype
  shim.wrap(proto, 'emit', wrapEmit)

  function wrapEmit(shim, original) {
    return function wrappedEmit(ev) {
      const shouldRestoreContext =
        ev === 'error' && shim.getActiveSegment() === null && shim.getSegment(this)

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
