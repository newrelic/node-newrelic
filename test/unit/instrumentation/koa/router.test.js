/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const instrumentation = require('../../../../lib/instrumentation/koa/router-instrumentation')
const { METHODS } = require('../../../../lib/instrumentation/http-methods')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')
const InstrumentationDescriptor = require('../../../../lib/instrumentation-descriptor')
const WRAPPED_METHODS = ['param', 'register', 'routes', 'middleware', 'allowedMethods']
const UNWRAPPED_METHODS = METHODS.concat([
  'use',
  'prefix',
  'all',
  'redirect',
  'route',
  'url',
  'match'
])
const UNWRAPPED_STATIC_METHODS = ['url']

// Trying to loop over the list of supported router mods results in:
// Error('Only one agent at a time! This one was created at:').
//
// So we unroll that loop.

test('koa-router', async (t) => {
  const koaRouterMod = 'koa-router'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      moduleName: koaRouterMod,
      type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
      onRequire: instrumentation,
      shimName: 'koa'
    })

    ctx.nr.mod = require(koaRouterMod)
    ctx.nr.shim = helper.getShim(ctx.nr.mod)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    removeModules([koaRouterMod])
  })

  await t.test('mounting paramware', async (t) => {
    const { mod: Router, shim } = t.nr
    const router = new Router()
    router.param('second', function () {})
    assert.ok(shim.isWrapped(router.params.second), 'param function should be wrapped')
  })

  await t.test('methods', async (t) => {
    const { mod: Router, shim } = t.nr
    WRAPPED_METHODS.forEach(function checkWrapped(method) {
      assert.ok(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a wrapped method on the prototype'
      )
    })
    UNWRAPPED_METHODS.forEach(function checkUnwrapped(method) {
      assert.notEqual(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a unwrapped method on the prototype'
      )
    })
    UNWRAPPED_STATIC_METHODS.forEach(function checkUnwrappedStatic(method) {
      assert.notEqual(
        shim.isWrapped(Router[method]),
        method + ' should be an unwrapped static method'
      )
    })
  })
})

test('@koa/router', async (t) => {
  const koaRouterMod = '@koa/router'

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      moduleName: koaRouterMod,
      type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
      onRequire: instrumentation,
      shimName: 'koa'
    })

    ctx.nr.mod = require(koaRouterMod)
    ctx.nr.shim = helper.getShim(ctx.nr.mod)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    removeModules([koaRouterMod])
  })

  await t.test('mounting paramware', async (t) => {
    const { mod: Router, shim } = t.nr
    const router = new Router()
    router.param('second', function () {})
    assert.ok(shim.isWrapped(router.params.second), 'param function should be wrapped')
  })

  await t.test('methods', async (t) => {
    const { mod: Router, shim } = t.nr
    WRAPPED_METHODS.forEach(function checkWrapped(method) {
      assert.ok(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a wrapped method on the prototype'
      )
    })
    UNWRAPPED_METHODS.forEach(function checkUnwrapped(method) {
      assert.notEqual(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a unwrapped method on the prototype'
      )
    })
    UNWRAPPED_STATIC_METHODS.forEach(function checkUnwrappedStatic(method) {
      assert.notEqual(
        shim.isWrapped(Router[method]),
        method + ' should be an unwrapped static method'
      )
    })
  })
})
