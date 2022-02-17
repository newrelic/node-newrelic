/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const util = require('util')
const initialize = require('../../lib/context')
const { util: testUtil, TestAgent } = require('@newrelic/test-utilities')

tap.test('middleware tracking', (t) => {
  t.autoend()
  let fakeCtx = {}
  const context = { context: { _ENTRIES: {} } }
  let helper
  let shim

  t.beforeEach(() => {
    helper = new TestAgent({})
    const agentLocation = testUtil.getNewRelicLocation()
    const Shim = require(`${agentLocation}/lib/shim/webframework-shim`)
    shim = new Shim(helper.agent, './context')

    fakeCtx = {
      getModuleContext: () => context
    }

    // instrument next.js module context
    initialize(shim, fakeCtx)
  })

  t.afterEach(() => {
    context.context._ENTRIES = {}
    helper.unload()
  })

  t.test('proxies _ENTRIES', (t) => {
    const result = fakeCtx.getModuleContext()
    t.ok(util.types.isProxy(result.context._ENTRIES))
    t.end()
  })

  t.test('only proxies _ENTRIES once', (t) => {
    const result = fakeCtx.getModuleContext()
    result.context._ENTRIES.foo = {
      default() {
        return 'bar'
      }
    }
    result.context._ENTRIES.baz = {
      default() {
        return 'bot'
      }
    }
    const ctx = fakeCtx.getModuleContext()
    t.same(ctx, result)
    t.end()
  })

  t.test('should not affect exeuction of original function', (t) => {
    const mwFn = {
      default() {
        return 'world'
      }
    }
    const result = fakeCtx.getModuleContext()
    result.context._ENTRIES.test = mwFn
    const req = {}
    t.equal(result.context._ENTRIES.test.default(req), 'world')
    t.end()
  })
})
