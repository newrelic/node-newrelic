/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const { NEXT } = require('./constants')

const PROP = Symbol('nrMiddlewareName')

module.exports = function initialize(shim, ctx) {
  /*
  Middleware is tracked via a 'module context' object
  whose `_ENTRIES` property is updated by each middleware layer.
  So, we proxy `_ENTRIES` and record a span whenever middleware modifies it.
  */
  shim.setFramework(NEXT)
  shim.wrap(ctx, 'getModuleContext', function middlewareRecorder(shim, getModuleContext) {
    return function wrappedModuleContext() {
      const result = getModuleContext.apply(this, arguments)
      const handler = {
        set(obj, prop, value) {
          const nrObj = Object.assign(Object.create(null), value)
          nrObj[PROP] = prop.replace(/^middleware_pages/, '')
          shim.record(nrObj, 'default', function mwRecord(shim, origMw, name, [args]) {
            const middlewareName = this[PROP]
            return {
              name: `Nodejs/Middleware/Nextjs/${middlewareName}`,
              type: shim.ROUTE,
              req: args.request,
              route: middlewareName,
              promise: true
            }
          })
          obj[prop] = nrObj
          return true
        }
      }
      if (!util.types.isProxy(result.context._ENTRIES)) {
        result.context._ENTRIES = new Proxy(result.context._ENTRIES, handler)
      }
      return result
    }
  })
}
