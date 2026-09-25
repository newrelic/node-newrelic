/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = initialize

/**
 * Note: This instrumentation is no longer required due
 * to proper context propagation via AsyncLocalStorage.
 *
 * We will remove this instrumentation in the next major
 * release (v15.x).
 * @see https://github.com/newrelic/node-newrelic/issues/4208
 */

function initialize(agent, domain, name, shim) {
  const proto = domain.Domain.prototype
  shim.wrap(proto, 'emit', wrapEmit)

  function wrapEmit(shim, original) {
    return function wrappedEmit(ev) {
      const ctx = agent.tracer.getContext()
      return agent.tracer.bindFunction(original, ctx).apply(this, arguments)
    }
  }
}
