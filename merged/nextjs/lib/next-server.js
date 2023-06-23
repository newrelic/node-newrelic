/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const semver = require('semver')
const { assignCLMAttrs } = require('./utils')
const SPAN_PREFIX = 'Nodejs/Nextjs'
// Version middleware is stable
// See: https://nextjs.org/docs/advanced-features/middleware
const MIN_MW_SUPPORTED_VERSION = '12.2.0'
const GET_SERVER_SIDE_PROP_VERSION = '13.4.5'

module.exports = function initialize(shim, nextServer) {
  const nextVersion = shim.require('./package.json').version
  const { config } = shim.agent
  shim.setFramework(shim.NEXT)

  const Server = nextServer.default

  shim.wrap(
    Server.prototype,
    'renderToResponseWithComponents',
    function wrapRenderToResponseWithComponents(shim, originalFn) {
      return function wrappedRenderToResponseWithComponents() {
        const { pathname } = arguments[0]
        // this is not query params but instead url params for dynamic routes
        const { query, components } = arguments[1]

        if (
          semver.gte(nextVersion, GET_SERVER_SIDE_PROP_VERSION) &&
          components.getServerSideProps
        ) {
          shim.record(
            components,
            'getServerSideProps',
            function recordGetServerSideProps(shim, orig, name, [{ req, res }]) {
              return {
                inContext(segment) {
                  segment.addSpanAttributes({ 'next.page': pathname })
                  assignCLMAttrs(config, segment, {
                    'code.function': 'getServerSideProps',
                    'code.filepath': `pages${pathname}`
                  })
                },
                req,
                res,
                promise: true,
                name: `${SPAN_PREFIX}/getServerSideProps/${pathname}`
              }
            }
          )
        }

        shim.setTransactionUri(pathname)

        assignParameters(shim, query)

        return originalFn.apply(this, arguments)
      }
    }
  )

  shim.wrap(Server.prototype, 'runApi', function wrapRunApi(shim, originalFn) {
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

  if (semver.lt(nextVersion, GET_SERVER_SIDE_PROP_VERSION)) {
    shim.record(
      Server.prototype,
      'renderHTML',
      function renderHTMLRecorder(shim, renderToHTML, name, [req, res, page]) {
        return {
          inContext(segment) {
            segment.addSpanAttributes({ 'next.page': page })
            assignCLMAttrs(config, segment, {
              'code.function': 'getServerSideProps',
              'code.filepath': `pages${page}`
            })
          },
          req,
          res,
          promise: true,
          name: `${SPAN_PREFIX}/getServerSideProps/${page}`
        }
      }
    )
  }

  if (semver.lt(nextVersion, MIN_MW_SUPPORTED_VERSION)) {
    shim.logger.warn(
      `Next.js middleware instrumentation only supported on >=${MIN_MW_SUPPORTED_VERSION}, got %s`,
      nextVersion
    )
    return
  }

  shim.record(
    Server.prototype,
    'runMiddleware',
    function runMiddlewareRecorder(shim, runMiddleware, name, [args]) {
      const middlewareName = 'middleware'
      return {
        type: shim.MIDDLEWARE,
        name: `${shim._metrics.MIDDLEWARE}${shim._metrics.PREFIX}/${middlewareName}`,
        inContext(segment) {
          assignCLMAttrs(config, segment, {
            'code.function': middlewareName,
            'code.filepath': middlewareName
          })
        },
        req: args.request,
        route: middlewareName,
        promise: true
      }
    }
  )
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
