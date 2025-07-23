/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = initialize

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
