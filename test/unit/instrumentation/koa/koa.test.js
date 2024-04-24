/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')
const InstrumentationDescriptor = require('../../../../lib/instrumentation-descriptor')

tap.beforeEach((t) => {
  t.context.agent = helper.instrumentMockedAgent({
    moduleName: 'koa',
    type: InstrumentationDescriptor.TYPE_WEB_FRAMEWORK,
    onRequire: require('../../../../lib/instrumentation/koa/instrumentation'),
    shimName: 'koa'
  })

  t.context.Koa = require('koa')
  t.context.shim = helper.getShim(t.context.Koa)
})

tap.afterEach((t) => {
  helper.unloadAgent(t.context.agent)
  removeModules(['koa'])
})

tap.test('Koa instrumentation', async (t) => {
  const wrapped = ['createContext', 'use', 'emit']
  const notWrapped = ['handleRequest', 'listen', 'toJSON', 'inspect', 'callback', 'onerror']
  const { Koa, shim } = t.context

  wrapped.forEach(function (method) {
    t.ok(shim.isWrapped(Koa.prototype[method]), method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function (method) {
    t.not(shim.isWrapped(Koa.prototype[method]), method + ' is not wrapped, as expected')
  })
})
