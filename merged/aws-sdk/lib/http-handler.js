/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.NodeHttpHandler)) {
    shim.logger.debug('Could not find Client, not instrumenting.')
    return false
  }
  return true
}

function wrapHandle(shim, send) {
  return function wrappedHandle(...args) {
    args[0].headers[shim.DISABLE_DT] = true
    return send.apply(this, args)
  }
}

module.exports = function instrumentHttpHandler(shim, AWS) {
  if (!validate(shim, AWS)) {
    return
  }

  shim.wrap(AWS.NodeHttpHandler.prototype, 'handle', wrapHandle)
}
