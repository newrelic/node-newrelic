/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const semver = require('semver')
const {
  assignCLMAttrs,
  isMiddlewareInstrumentationSupported,
  MIN_MW_SUPPORTED_VERSION,
  MAX_MW_SUPPORTED_VERSION
} = require('./utils')
const { RecorderSpec } = require('../../shim/specs')
const SPAN_PREFIX = 'Nodejs/Nextjs'
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
        const [ctx, result] = arguments
        const { pathname, renderOpts } = ctx
        // this is not query params but instead url params for dynamic routes
        const { query, components } = result

        if (
          semver.gte(nextVersion, GET_SERVER_SIDE_PROP_VERSION) &&
          components.getServerSideProps
        ) {
          shim.record(components, 'getServerSideProps', function recordGetServerSideProps() {
            return new RecorderSpec({
              inContext(segment) {
                segment.addSpanAttributes({ 'next.page': pathname })
                assignCLMAttrs(config, segment, {
                  'code.function': 'getServerSideProps',
                  'code.filepath': `pages${pathname}`
                })
              },
              promise: true,
              name: `${SPAN_PREFIX}/getServerSideProps/${pathname}`
            })
          })
        }

        shim.setTransactionUri(pathname)

        const urlParams = extractRouteParams(ctx.query, renderOpts?.params || query)
        assignParameters(shim, urlParams)

        return originalFn.apply(this, arguments)
      }
    }
  )

  shim.wrap(Server.prototype, 'runApi', function wrapRunApi(shim, originalFn) {
    return function wrappedRunApi() {
      const { page, params } = extractAttrs(arguments, nextVersion)

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
      function renderHTMLRecorder(shim, renderToHTML, name, [, , page]) {
        return new RecorderSpec({
          inContext(segment) {
            segment.addSpanAttributes({ 'next.page': page })
            assignCLMAttrs(config, segment, {
              'code.function': 'getServerSideProps',
              'code.filepath': `pages${page}`
            })
          },
          promise: true,
          name: `${SPAN_PREFIX}/getServerSideProps/${page}`
        })
      }
    )
  }

  if (!isMiddlewareInstrumentationSupported(nextVersion)) {
    shim.logger.warn(
      `Next.js middleware instrumentation only supported on >=${MIN_MW_SUPPORTED_VERSION} <=${MAX_MW_SUPPORTED_VERSION}, got %s`,
      nextVersion
    )
    return
  }

  shim.record(Server.prototype, 'runMiddleware', function runMiddlewareRecorder(shim) {
    const middlewareName = 'middleware'
    return new RecorderSpec({
      type: shim.MIDDLEWARE,
      name: `${shim._metrics.MIDDLEWARE}${shim._metrics.PREFIX}/${middlewareName}`,
      inContext(segment) {
        assignCLMAttrs(config, segment, {
          'code.function': middlewareName,
          'code.filepath': middlewareName
        })
      },
      promise: true
    })
  })
}

function assignParameters(shim, parameters) {
  const transaction = shim.tracer.getTransaction()
  if (transaction) {
    // We have to add params because this framework doesn't
    // follow the traditional middleware/middleware mounter pattern
    // where we'd pull these from middleware.
    transaction.nameState.appendPath('/', parameters)
  }
}

/**
 * Extracts the page and params from an API request
 *
 * @param {object} args arguments to runApi
 * @param {string} version next.js version
 * @returns {object} { page, params }
 */
function extractAttrs(args, version) {
  let params
  let page
  if (semver.gte(version, '13.4.13')) {
    const [, , , match] = args
    page = match?.definition?.pathname
    params = { ...match?.params }
  } else {
    ;[, , , params, page] = args
  }

  return { params, page }
}

/**
 * Extracts route params from an object that contains both
 * query and route params. The query params are automatically
 * assigned when transaction finishes based on the url
 *
 * @param {object} query query params for given function call
 * @param {object} params next.js params that contain query, route, and built in params
 * @returns {object} route params
 */
function extractRouteParams(query = {}, params = {}) {
  const queryParams = Object.keys(query)
  const urlParams = {}
  for (const [key, value] of Object.entries(params)) {
    if (!queryParams.includes(key)) {
      urlParams[key] = value
    }
  }

  return urlParams
}
