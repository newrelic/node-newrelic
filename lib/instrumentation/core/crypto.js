/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { RecorderSpec } = require('../../../lib/shim/specs')

module.exports = initialize

function initialize(agent, crypto, moduleName, shim) {
  shim.record(
    crypto,
    ['pbkdf2', 'randomBytes', 'pseudoRandomBytes', 'randomFill', 'scrypt'],
    function recordCryptoMethod(shim, fn, name) {
      return new RecorderSpec({
        name: 'crypto.' + name,
        callback: shim.LAST,
        callbackRequired: true // sync version used too heavily - too much overhead
      })
    }
  )
}
