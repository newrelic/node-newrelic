/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var methods = require('methods')

tap.test('koa-route', function(t) {
  var helper = utils.TestAgent.makeInstrumented()

  t.tearDown(function() {
    helper.unload()
  })

  helper.registerInstrumentation({
    type: 'web-framework',
    moduleName: 'koa-route',
    onRequire: require('../../lib/route-instrumentation.js')
  })

  t.test('methods', function(t) {
    var route = require('koa-route')
    methods.forEach(function checkWrapped(method) {
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
