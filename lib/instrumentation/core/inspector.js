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

function initialize(agent, inspector, name, shim) {
  const sessionProto = inspector && inspector.Session && inspector.Session.prototype
  if (!sessionProto) {
    return false
  }

  shim.wrap(sessionProto, 'post', function wrapPost(shim, fn) {
    return function wrappedPost(...args) {
      shim.bindCallbackSegment(null, args, shim.LAST)
      return fn.apply(this, args)
    }
  })
}
