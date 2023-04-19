/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const instrumentation = require('../../lib/router-instrumentation.js')
const { METHODS } = require('../../lib/http-methods')
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

const koaRouterMods = ['koa-router', '@koa/router']

koaRouterMods.forEach((koaRouterMod) => {
  tap.test(koaRouterMod, function tests(t) {
    const helper = utils.TestAgent.makeInstrumented()
    t.teardown(function () {
      helper.unload()
    })
    const shim = helper.getShim()

    helper.registerInstrumentation({
      type: 'web-framework',
      moduleName: koaRouterMod,
      onRequire: instrumentation,
      shimName: 'koa'
    })

    t.test('mounting paramware', function (t) {
      var Router = require(koaRouterMod)
      var router = new Router()
      router.param('second', function () {})
      t.ok(shim.isWrapped(router.params.second), 'param function should be wrapped')
      t.end()
    })

    t.test('methods', function (t) {
      var Router = require(koaRouterMod)
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
      t.end()
    })
    t.autoend()
  })
})
