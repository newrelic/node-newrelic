/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const INSTRUMENTATIONS = [
  require('./core'),
  require('./dynamodb'),
  require('./sqs'),
  require('./sns')
]

const helper = require('./instrumentation-helper')

module.exports = function initialize(shim, AWS) {
  if (!helper.instrumentationSupported(AWS)) {
    return false
  }
  // Validate every instrumentation before attempting to run any of them.
  for (let instrumentation of INSTRUMENTATIONS) {
    if (!instrumentation.validate(shim, AWS)) {
      return false
    }
  }

  for (let instrumentation of INSTRUMENTATIONS) {
    const subshim = shim.makeSpecializedShim(instrumentation.type, instrumentation.name)
    instrumentation.instrument(subshim, AWS)
  }

  return true
}
