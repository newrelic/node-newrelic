'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')

utils.tap

tap.test('Koa instrumentation', function(t) {
  var helper = utils.TestAgent.makeInstrumented()
  helper.registerInstrumentation({
    moduleName: 'koa',
    type: 'web-framework',
    onRequire: require('../../lib/instrumentation')
  })
  var Koa = require('koa')

  var wrapped = [ 'createContext', 'use', 'emit' ]
  var notWrapped = [
    'handleRequest', 'listen', 'toJSON',
    'inspect', 'callback', 'onerror'
  ]

  wrapped.forEach(function(method) {
    t.ok(Koa.prototype[method].__NR_original, method + ' is wrapped, as expected')
  })
  notWrapped.forEach(function(method) {
    t.notOk(Koa.prototype[method].__NR_original, method + ' is not wrapped, as expected')
  })

  helper && helper.unload()
  t.end()
})
