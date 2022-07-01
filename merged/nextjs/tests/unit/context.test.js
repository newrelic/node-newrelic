/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const util = require('util')
const sinon = require('sinon')
const initialize = require('../../lib/context')
const { util: testUtil, TestAgent } = require('@newrelic/test-utilities')

tap.test('middleware tracking', (t) => {
  t.autoend()
  let fakeCtx = {}
  const context = { runtime: { context: { _ENTRIES: {} } } }
  let helper
  let shim

  t.beforeEach(() => {
    helper = new TestAgent({})
    const agentLocation = testUtil.getNewRelicLocation()
    const Shim = require(`${agentLocation}/lib/shim/webframework-shim`)
    shim = new Shim(helper.agent, './context')
    sinon.stub(shim, 'require')
    shim.require.returns({ version: '12.2.0' })

    fakeCtx = {
      getModuleContext: () => context
    }

    // instrument next.js module context
    initialize(shim, fakeCtx)
  })

  t.afterEach(() => {
    context.runtime.context._ENTRIES = {}
    helper.unload()
  })

  t.test('proxies _ENTRIES', async (t) => {
    const result = await fakeCtx.getModuleContext()
    t.ok(util.types.isProxy(result.runtime.context._ENTRIES))
    t.end()
  })

  t.test('only proxies _ENTRIES once', async (t) => {
    const result = await fakeCtx.getModuleContext()
    result.runtime.context._ENTRIES.foo = {
      default() {
        return 'bar'
      }
    }
    result.runtime.context._ENTRIES.baz = {
      default() {
        return 'bot'
      }
    }
    const ctx = await fakeCtx.getModuleContext()
    t.same(ctx, result)
  })

  t.test('should not affect exeuction of original function', async (t) => {
    const mwFn = {
      default() {
        return 'world'
      }
    }
    const result = await fakeCtx.getModuleContext()
    result.runtime.context._ENTRIES.test = mwFn
    const req = {}
    t.equal(result.runtime.context._ENTRIES.test.default(req), 'world')
    t.end()
  })

  t.test('should not instrument getModuleContext if Next.js < 12.2.0', (t) => {
    sinon.spy(shim.logger, 'debug')
    shim.require.returns({ version: '12.0.1' })
    const newCtx = { getModuleContext: sinon.stub() }
    initialize(shim, newCtx)
    t.equal(shim.logger.debug.callCount, 1, 'should log debug message')
    const loggerArgs = shim.logger.debug.args[0]
    t.same(loggerArgs, [
      'Next.js middleware instrumentation only supported on >=12.2.0, got %s',
      '12.0.1'
    ])
    t.notOk(
      shim.isWrapped(newCtx.getModuleContext),
      'should not wrap getModuleContext when version is less than 12.2.0'
    )
    t.end()
  })
})
