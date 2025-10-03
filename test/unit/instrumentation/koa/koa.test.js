/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../../lib/agent_helper')
const { removeModules } = require('../../../lib/cache-buster')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.Koa = require('koa')
  ctx.nr.shim = helper.getShim(ctx.nr.Koa)
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['koa'])
})

test('Koa instrumentation', async (t) => {
  const wrapped = ['createContext', 'use', 'emit']
  const notWrapped = ['handleRequest', 'listen', 'toJSON', 'inspect', 'callback', 'onerror']
  const { Koa, shim } = t.nr

  wrapped.forEach(function (method) {
    assert.ok(shim.isWrapped(Koa.prototype[method]), method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function (method) {
    assert.notEqual(shim.isWrapped(Koa.prototype[method]), method + ' is not wrapped, as expected')
  })
})
