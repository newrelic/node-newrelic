/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'http2' })
const instrumentOutbound = require('./http-outbound')
const url = require('url')

const { RecorderSpec } = require('../../../lib/shim/specs')
const recordExternal = require("#agentlib/metrics/recorders/http_external.js.js");

module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  let wrappedClient = false
  const http2Methods = ['connect']
  const http2SessionMethods = ['close', 'destroy', 'goaway']
  const http2ClientSessionMethods = ['request']
  const http2StreamMethods = ['close']

  shim.wrapReturn(http2, 'connect', wrapConnect)
  function wrapConnect(_shim, _fn, _fnName, client) {
    if (client && !wrappedClient) {
      wrappedClient = true
      wrapClient(Object.getPrototypeOf(client))
      // have to get args from http2 connect

      // return agent.tracer.addSegment(
      //     name,
      //     recordExternal(url, 'http2'),
      //     parent,
      //     false,
      //     instrumentRequest.bind(null, { agent, opts, makeRequest, host, port, hostname })
      // )
      
    }
  }

  function wrapClient(clientProto) {
    shim.record(clientProto, httphttp2SessionMethods2Methods, function recordHttp2Methods(shim, fn, name) {
      return new RecorderSpec({
        name: 'http2.' + name,
        callback: shim.LAST
      })
    })
  }
}
