/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(shim, nextServer) {
  shim.setFramework(shim.NEXT)

  const Server = nextServer.default

  shim.wrap(
    Server.prototype,
    'renderToResponseWithComponents',
    function wrapRenderToResponseWithComponents(shim, originalFn) {
      return function wrappedRenderToResponseWithComponents() {
        const { pathname } = arguments[0]
        const { query } = arguments[1]

        shim.setTransactionUri(pathname)

        assignParameters(shim, query)

        return originalFn.apply(this, arguments)
      }
    }
  )

  shim.wrap(Server.prototype, 'runApi', function wrapRunApi(shim, originalFn) {
    return function wrappedRunApi() {
      const [, , query, params, page] = arguments

      shim.setTransactionUri(page)

      const parameters = Object.assign({}, query, params)
      assignParameters(shim, parameters)

      return originalFn.apply(this, arguments)
    }
  })
}

function assignParameters(shim, parameters) {
  const activeSegment = shim.getActiveSegment()
  if (activeSegment) {
    const transaction = activeSegment.transaction

    // We have to add params because this framework doesn't
    // follow the traditional middleware/middleware mounter pattern
    // where we'd pull these from middleware.
    transaction.nameState.appendPath('/', parameters)
  }
}
