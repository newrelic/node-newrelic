/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = function initialize(shim, nextServer) {
  const Server = nextServer.default
  shim.setFramework('Nextjs')

  shim.record(
    Server.prototype,
    'renderToResponse',
    function wrapRequest(shim, renderToResponse, name, [args]) {
      const route = findRoute.apply(this, [args.pathname])
      shim.setTransactionUri(route)
      return {
        name: `Nodejs/Middleware/Nextjs/renderToResponse/${route}`,
        promise: true
      }
    }
  )

  shim.record(
    Server.prototype,
    'handleApiRequest',
    function wrapRequest(shim, handleApiRequest, name, args) {
      const route = findRoute.apply(this, [args[2]])
      shim.setTransactionUri(route)
      return {
        name: `Nodejs/Middleware/Nextjs/${route}`,
        req: args[0],
        res: args[1],
        promise: true
      }
    }
  )

  /**
   * In case of a dynamic route, look for the appropriate name
   *
   * @param url
   */
  function findRoute(url) {
    for (const route of this.dynamicRoutes) {
      if (route.match(url)) {
        return route.page
      }
    }

    return url
  }
}
