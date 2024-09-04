/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { METHODS } = require('../../../../lib/instrumentation/http-methods')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')
const InstrumentationDescriptor = require('../../../../lib/instrumentation-descriptor')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    moduleName: 'koa-route',
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    onRequire: require('../../../../lib/instrumentation/koa/route-instrumentation'),
    shimName: 'koa'
  })

  ctx.nr.KoaRoute = require('koa-route')
  ctx.nr.shim = helper.getShim(ctx.nr.KoaRoute)
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['koa-route'])
})

test('methods', async function (t) {
  const { KoaRoute: route, shim } = t.nr
  METHODS.forEach(function checkWrapped(method) {
    assert.ok(shim.isWrapped(route[method]), method + ' should be wrapped')
  })
})
