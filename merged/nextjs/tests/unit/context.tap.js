/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const util = require('util')
const initialize = require('../../lib/context')

tap.test('middleware tracking', (t) => {
  t.autoend()

  t.test('records middleware', (t) => {
    t.autoend()

    let wrapped = false
    let recorded = false

    const fakeShim = {
      setFramework: () => {},
      wrap: (thing, prop, handler) => {
        const original = thing[prop]
        thing[prop] = handler(fakeShim, original)
        wrapped = true
      },
      record: () => {
        recorded = true
      }
    }

    const fakeCtx = {
      getModuleContext: () => {
        return { context: { _ENTRIES: {} } }
      }
    }

    // instrument next.js module context
    initialize(fakeShim, fakeCtx)
    // run wrapped getter
    const result = fakeCtx.getModuleContext()
    // verify that we proxied it ok
    t.ok(util.types.isProxy(result.context._ENTRIES))
    t.equal(wrapped, true)
    // verify that updating the proxy records a span
    t.equal(recorded, false)
    result.context._ENTRIES['middleware_pages/hello'] = 'world'
    t.equal(recorded, true)
  })
})
