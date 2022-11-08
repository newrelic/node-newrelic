/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

utils.tap

tap.test('Koa instrumentation', function (t) {
  const wrapped = ['createContext', 'use', 'emit']
  const notWrapped = ['handleRequest', 'listen', 'toJSON', 'inspect', 'callback', 'onerror']

  const helper = utils.TestAgent.makeInstrumented()
  helper.registerInstrumentation({
    moduleName: 'koa',
    type: 'web-framework',
    onRequire: require('../../lib/instrumentation')
  })
  const Koa = require('koa')
  const shim = helper.getShim()

  wrapped.forEach(function (method) {
    t.ok(shim.isWrapped(Koa.prototype[method]), method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function (method) {
    t.not(shim.isWrapped(Koa.prototype[method]), method + ' is not wrapped, as expected')
  })

  helper && helper.unload()
  t.end()
})
