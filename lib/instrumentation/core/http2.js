/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'http2' })

const { RecorderSpec } = require('../../../lib/shim/specs')
const recordExternal = require('../../../lib/metrics/recorders/http_external')
const instrumentOutbound = require('./http-outbound')

module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrap(http2, 'connect', wrapConnect)

  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      const context = this
      // URL is args[0]

      // http-outbound doesn't work with http2; arguments are all different.
      return instrumentOutbound(agent, args, function makeRequest(args) {
        // args[0] = opts
        return fn.apply(context, args)
      }, 'http2')
    }
  }
}
