/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

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

tap.test('koa-router', (t) => {
  const koaRouterMod = 'koa-router'

  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent({
      moduleName: koaRouterMod,
      type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
      onRequire: instrumentation,
      shimName: 'koa'
    })

    t.context.mod = require(koaRouterMod)
    t.context.shim = helper.getShim(t.context.mod)
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    removeModules([koaRouterMod])
  })

  t.test('mounting paramware', async (t) => {
    const { mod: Router, shim } = t.context
    const router = new Router()
    router.param('second', function () {})
    t.ok(shim.isWrapped(router.params.second), 'param function should be wrapped')
    t.end()
  })

  t.test('methods', async (t) => {
    const { mod: Router, shim } = t.context
    WRAPPED_METHODS.forEach(function checkWrapped(method) {
      t.ok(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a wrapped method on the prototype'
      )
    })
    UNWRAPPED_METHODS.forEach(function checkUnwrapped(method) {
      t.not(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a unwrapped method on the prototype'
      )
    })
    UNWRAPPED_STATIC_METHODS.forEach(function checkUnwrappedStatic(method) {
      t.not(shim.isWrapped(Router[method]), method + ' should be an unwrapped static method')
    })
  })

  t.end()
})

tap.test('koa-router', (t) => {
  const koaRouterMod = '@koa/router'

  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent({
      moduleName: koaRouterMod,
      type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
      onRequire: instrumentation,
      shimName: 'koa'
    })

    t.context.mod = require(koaRouterMod)
    t.context.shim = helper.getShim(t.context.mod)
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    removeModules([koaRouterMod])
  })

  t.test('mounting paramware', async (t) => {
    const { mod: Router, shim } = t.context
    const router = new Router()
    router.param('second', function () {})
    t.ok(shim.isWrapped(router.params.second), 'param function should be wrapped')
    t.end()
  })

  t.test('methods', async (t) => {
    const { mod: Router, shim } = t.context
    WRAPPED_METHODS.forEach(function checkWrapped(method) {
      t.ok(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a wrapped method on the prototype'
      )
    })
    UNWRAPPED_METHODS.forEach(function checkUnwrapped(method) {
      t.not(
        shim.isWrapped(Router.prototype[method]),
        method + ' should be a unwrapped method on the prototype'
      )
    })
    UNWRAPPED_STATIC_METHODS.forEach(function checkUnwrappedStatic(method) {
      t.not(shim.isWrapped(Router[method]), method + ' should be an unwrapped static method')
    })
  })

  t.end()
})
