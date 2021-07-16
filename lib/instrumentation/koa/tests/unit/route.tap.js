/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const { METHODS } = require('../../lib/http-methods')

tap.test('koa-route', function(t) {
  var helper = utils.TestAgent.makeInstrumented()

  t.teardown(function() {
    helper.unload()
  })

  helper.registerInstrumentation({
    type: 'web-framework',
    moduleName: 'koa-route',
    onRequire: require('../../lib/route-instrumentation.js')
  })

  t.test('methods', function(t) {
    var route = require('koa-route')
    METHODS.forEach(function checkWrapped(method) {
      t.type(
        route[method].__NR_original,
        'function',
        method + ' should be wrapped'
      )
    })
    t.end()
  })

  t.autoend()
})
