/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { assignCLMAttrs } = require('./utils')

module.exports = function initialize(shim, nextServer) {
  shim.setFramework(shim.NEXT)

  const Server = nextServer.default

  shim.wrap(
    Server.prototype,
    'renderToResponseWithComponents',
    function wrapRenderToResponseWithComponents(shim, originalFn) {
      return function wrappedRenderToResponseWithComponents() {
        const { pathname } = arguments[0]
        // this is not query params but instead url params for dynamic routes
        const { query } = arguments[1]

        shim.setTransactionUri(pathname)

        assignParameters(shim, query)

        return originalFn.apply(this, arguments)
      }
    }
  )

  shim.wrap(Server.prototype, 'runApi', function wrapRunApi(shim, originalFn) {
    const { config } = shim.agent
    return function wrappedRunApi() {
      const [, , , params, page] = arguments

      shim.setTransactionUri(page)

      assignParameters(shim, params)
      assignCLMAttrs(config, shim.getActiveSegment(), {
        'code.function': 'handler',
        'code.filepath': `pages${page}`
      })

      return originalFn.apply(this, arguments)
    }
  })
}

function assignParameters(shim, parameters) {
  const activeSegment = shim.getActiveSegment()
  if (activeSegment) {
    const transaction = activeSegment.transaction

    const prefixedParameters = shim.prefixRouteParameters(parameters)

    // We have to add params because this framework doesn't
    // follow the traditional middleware/middleware mounter pattern
    // where we'd pull these from middleware.
    transaction.nameState.appendPath('/', prefixedParameters)
  }
}
