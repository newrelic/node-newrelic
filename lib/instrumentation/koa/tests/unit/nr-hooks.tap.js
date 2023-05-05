/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const hooks = require('../../nr-hooks')

utils.tap

tap.test('Testing koa instrumentation via hooks', function (t) {
  const helper = utils.TestAgent.makeInstrumented()

  const wrapped = ['createContext', 'use', 'emit']
  const notWrapped = ['handleRequest', 'listen', 'toJSON', 'inspect', 'callback', 'onerror']

  hooks.forEach((hook) => {
    helper.registerInstrumentation(hook)
  })

  const Koa = require('koa')
  const shim = helper.getShim(Koa)

  wrapped.forEach(function (method) {
    t.ok(shim.isWrapped(Koa.prototype[method]), method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function (method) {
    t.not(shim.isWrapped(Koa.prototype[method]), method + ' is not wrapped, as expected')
  })

  helper && helper.unload()
  t.end()
})
