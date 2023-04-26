/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const { METHODS } = require('../../lib/http-methods')
const getShim = require('./getShim')

tap.test('koa-route', function (t) {
  const helper = utils.TestAgent.makeInstrumented()

  t.teardown(function () {
    helper.unload()
  })

  helper.registerInstrumentation({
    type: 'web-framework',
    moduleName: 'koa-route',
    onRequire: require('../../lib/route-instrumentation.js'),
    shimName: 'koa'
  })

  const route = require('koa-route')
  const shim = getShim(route)

  t.test('methods', function (t) {
    METHODS.forEach(function checkWrapped(method) {
      t.ok(shim.isWrapped(route[method]), method + ' should be wrapped')
    })
    t.end()
  })

  t.autoend()
})
