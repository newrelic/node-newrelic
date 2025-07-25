/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrapReturn(http2, 'connect', wrapSession)

  // http2's connect method returns a session instance, from which the request is called
  function wrapSession(shim, fn, fnName, session) {
    return function wrappedSession(...args) {
      // args[0] is a string--the URL of the remote server

      shim.wrap(Object.getPrototypeOf(session), ['ref', 'unref', 'close', 'destroy', 'goaway', 'ping'], wrapSessionMethods)
      shim.wrap(session, ['request'], wrapRequest)
      // we'll instrument this later if we need to; right now we're interested in request
      return fn.apply(this, args)
    }
  }

  function wrapSessionMethods(shim, fn) {
    return function wrappedMethods(...args) {
      if (!shim.getActiveSegment()) {
        return fn.apply(this, args)
      }
      const cbIndex = args.length - 1
      shim.bindSegment(args, cbIndex)
      return fn.apply(this, args)
    }
  }

  function wrapRequest(shim, fn) {
    return function wrappedRequest(...args) {
      if (!agent.getTransaction()) {
        return fn.apply(this, arguments)
      }
      const context = shim.tracer.getContext()
      const segment = shim.createSegment({ name: 'http2.request', parent: context.segment })

      if (args) {
        args = shim.bindSegment(args, segment)
      }

      return shim.applySegment(fn, segment, true, this, args)
      // // args[0] here is the headers of the request.
      // return instrumentOutboundHttp2Request(agent, args, function makeRequest(args) {
      //   return fn.apply(context, args)
      // })
    }
  }
}
