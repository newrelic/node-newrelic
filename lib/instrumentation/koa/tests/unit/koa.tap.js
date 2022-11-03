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

  // Save the original methods, to compare with wrapped ones below
  const origKoa = require('koa')
  const origMethods = Object.fromEntries(
    wrapped.concat(notWrapped).map((method) => [method, origKoa.prototype[method]])
  )

  const helper = utils.TestAgent.makeInstrumented()
  helper.registerInstrumentation({
    moduleName: 'koa',
    type: 'web-framework',
    onRequire: require('../../lib/instrumentation')
  })
  const Koa = require('koa')

  wrapped.forEach(function (method) {
    t.not(Koa.prototype[method], origMethods[method], method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function (method) {
    t.equal(Koa.prototype[method], origMethods[method], method + ' is not wrapped, as expected')
  })

  helper && helper.unload()
  t.end()
})
