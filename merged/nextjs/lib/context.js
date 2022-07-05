/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const semver = require('semver')

// Version middleware is stable
// See: https://nextjs.org/docs/advanced-features/middleware
const MIN_SUPPORTED_VERSION = '12.2.0'

module.exports = function initialize(shim, ctx) {
  const nextVersion = shim.require('./package.json').version

  if (semver.lt(nextVersion, MIN_SUPPORTED_VERSION)) {
    shim.logger.warn(
      'Next.js middleware instrumentation only supported on >=12.2.0, got %s',
      nextVersion
    )
    return
  }

  /*
  Middleware is tracked via a 'module context' object
  whose `runtime.context._ENTRIES` property is updated by middleware.
  So, we proxy `runtime.context._ENTRIES` and record a span whenever middleware modifies it.
  */
  shim.setFramework(shim.NEXT)

  shim.wrap(ctx, 'getModuleContext', function middlewareRecorder(shim, getModuleContext) {
    // define proxy handler that adds a set trap and re-assigns the middleware handler
    // with a wrapped function to record the middleware handler execution.
    const handler = {
      set(obj, prop, value) {
        const nrObj = Object.assign(Object.create(null), value)
        shim.record(nrObj, 'default', function mwRecord(shim, origMw, name, [args]) {
          const middlewareName = 'middleware'
          return {
            name: `${shim._metrics.MIDDLEWARE}${shim._metrics.PREFIX}/${middlewareName}`,
            type: shim.MIDDLEWARE,
            req: args.request,
            route: middlewareName,
            promise: true
          }
        })
        obj[prop] = nrObj
        return true
      }
    }

    /**
     * Check if the context.runtime.context._ENTRIES object is a proxy, and make it one if not.
     * Note: In 12.2.0 they flattened middleware and put the context on runtime property
     * It also does not pre-emptively make the `_ENTRIES` object so we will create that
     * so we can properly trap all sets
     * @param {Object} moduleContext return of `getModuleContext`
     */
    function maybeApplyProxyHandler(moduleContext) {
      if (moduleContext.runtime && moduleContext.runtime.context) {
        if (!moduleContext.runtime.context._ENTRIES) {
          moduleContext.runtime.context._ENTRIES = {}
        }

        if (!util.types.isProxy(moduleContext.runtime.context._ENTRIES)) {
          moduleContext.runtime.context._ENTRIES = new Proxy(
            moduleContext.runtime.context._ENTRIES,
            handler
          )
        }
      }
    }

    return async function wrappedModuleContextPromise() {
      const result = await getModuleContext.apply(this, arguments)
      maybeApplyProxyHandler(result)
      return result
    }
  })
}
