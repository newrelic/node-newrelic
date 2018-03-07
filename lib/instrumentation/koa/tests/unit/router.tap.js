'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var methods = require('methods')
var instrumentation = require('../../lib/router-instrumentation.js')

var WRAPPED_METHODS = [
  'param'
]

var UNWRAPPED_METHODS = methods.concat([
  'register',
  'use',
  'prefix',
  'routes',
  'middleware',
  'allowedMethods',
  'all',
  'redirect',
  'route',
  'url',
  'match'
])

var UNWRAPPED_STATIC_METHODS = [
  'url'
]

tap.test('koa-router', function tests(t) {
  var helper = utils.TestAgent.makeInstrumented()
  t.tearDown(function() {helper.unload()})
  helper.registerInstrumentation({
    type: 'web-framework',
    moduleName: 'koa-router',
    onRequire: instrumentation
  })

  t.test('mounting paramware', function(t) {
    var Router = require('koa-router')
    var router = new Router()
    router.param('second', function() {})
    t.type(
      router.params.second.__NR_original,
      'function',
      'param function should be wrapped'
    )
    t.end()
  })

  t.test('methods', function(t) {
    var Router = require('koa-router')
    WRAPPED_METHODS.forEach(function checkWrapped(method) {
      t.type(
        Router.prototype[method].__NR_original,
        'function',
        method + ' should be a wrapped method on the prototype'
      )
    })
    UNWRAPPED_METHODS.forEach(function checkUnwrapped(method) {
      t.type(
        Router.prototype[method].__NR_original,
        'undefined',
        method + ' should be a unwrapped method on the prototype'
      )
    })
    UNWRAPPED_STATIC_METHODS.forEach(function checkUnwrappedStatic(method) {
      t.type(
        Router[method].__NR_original,
        'undefined',
        method + ' should be an unwrapped static method'
      )
    })
    t.end()
  })
  t.autoend()
})
