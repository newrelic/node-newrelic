/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { METHODS } = require('../../../../lib/instrumentation/http-methods')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')
const InstrumentationDescriptor = require('../../../../lib/instrumentation-descriptor')

tap.beforeEach((t) => {
  t.context.agent = helper.instrumentMockedAgent({
    moduleName: 'koa-route',
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    onRequire: require('../../../../lib/instrumentation/koa/route-instrumentation'),
    shimName: 'koa'
  })

  t.context.KoaRoute = require('koa-route')
  t.context.shim = helper.getShim(t.context.KoaRoute)
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
  removeModules(['koa-route'])
})

tap.test('methods', function (t) {
  const { KoaRoute: route, shim } = t.context
  METHODS.forEach(function checkWrapped(method) {
    t.ok(shim.isWrapped(route[method]), method + ' should be wrapped')
  })
  t.end()
})
