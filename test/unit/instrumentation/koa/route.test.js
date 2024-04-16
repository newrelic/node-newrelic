/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { METHODS } = require('../../../../lib/instrumentation/koa/lib/http-methods')
const helper = require('../../../lib/agent_helper')
const InstrumentationDescriptor = require('../../../../lib/instrumentation-descriptor')
const symbols = require('../../../../lib/symbols')

tap.beforeEach((t) => {
  t.context.agent = helper.instrumentMockedAgent({
    moduleName: 'koa-route',
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    onRequire: require('../../../../lib/instrumentation/koa/lib/route-instrumentation'),
    shimName: 'koa'
  })

  t.context.KoaRoute = require('koa-route')
  t.context.shim = t.context.KoaRoute[symbols.shim]
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('koa-route')) {
      delete require.cache[key]
    }
  })
})

tap.test('methods', function (t) {
  const { KoaRoute: route, shim } = t.context
  METHODS.forEach(function checkWrapped(method) {
    t.ok(shim.isWrapped(route[method]), method + ' should be wrapped')
  })
  t.end()
})
