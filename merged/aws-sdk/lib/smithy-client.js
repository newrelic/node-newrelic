/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const NR_CONFIG = Symbol('newrelic.aws-sdk.config')

function validate(shim, AWS) {
  if (!shim.isFunction(AWS.Client)) {
    shim.logger.debug('Could not find Client, not instrumenting.')
    return false
  }
  return true
}

function wrapClientSend(shim, send) {
  return function wrappedSend(...args) {
    // Attaching config as symbol to be used
    // in MiddlewareStack instrumentation
    args[0][NR_CONFIG] = this.config
    return send.apply(this, args)
  }
}

module.exports = function instrumentSmithyClient(shim, AWS) {
  if (!validate(shim, AWS)) {
    return
  }

  shim.wrap(AWS.Client.prototype, 'send', wrapClientSend)
}

module.exports.NR_CONFIG = NR_CONFIG
