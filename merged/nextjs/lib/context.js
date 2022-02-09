/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const PROP = Symbol('nrMwName')
const util = require('util')

console.log('a')

module.exports = function initialize(shim, ctx) {
  console.log(ctx)
  console.log('b')
  shim.setFramework(shim.NEXT)
  debugger
  shim.wrap(ctx, 'getModuleContext', function middlewareRecorder(shim, getModuleContext) {
    console.log('c')
    return function wrappedModuleContext() {
      const result = getModuleContext.apply(this, arguments)
      const handler = {
        set(obj, prop, value) {
          console.log('d')
          const nrObj = Object.assign(Object.create(null), value)
          nrObj[PROP] = prop.replace(/^middleware_/, '')
          shim.record(nrObj, 'default', function mwRecord(shim, origMw, name, [args]) {
            console.log('e')
            const mwName = this[PROP]
            return {
              name: `Nodejs/Middleware/Nextjs/${mwName}`,
              type: shim.ROUTE,
              req: args.request,
              route: mwName,
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
