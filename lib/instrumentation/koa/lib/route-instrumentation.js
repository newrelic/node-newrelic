/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { METHODS } = require('./http-methods')

module.exports = function instrumentRoute(shim, route) {
  shim.setFramework(shim.KOA)

  METHODS.forEach(function wrap(method) {
    shim.wrap(route, method, function wrapMethod(shim, methodFn) {
      return function wrappedMethod() {
        const middleware = methodFn.apply(route, arguments)
        return shim.recordMiddleware(middleware, {
          type: shim.MIDDLEWARE,
          route: arguments[0],
          next: shim.LAST,
          name: shim.getName(arguments[1]),
          promise: true,
          req: function getReq(shim, fn, fnName, args) {
            return args[0] && args[0].req
          }
        })
      }
    })
  })
}
