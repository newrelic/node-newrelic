'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var http = require('http')

utils(tap)

tap.test('koa-route instrumentation', function(t) {
  var helper = null
  var app = null
  var server = null
  var route = null

  t.beforeEach(function(done) {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'koa',
      type: 'web-framework',
      onRequire: require('../../lib/instrumentation')
    })
    helper.registerInstrumentation({
      moduleName: 'koa-route',
      type: 'web-framework',
      onRequire: require('../../lib/router-instrumentation')
    })
    var Koa = require('koa')
    app = new Koa()
    route = require('koa-route')
    done()
  })

  t.afterEach(function(done) {
    server.close()
    app = null
    route = null
    helper && helper.unload()
    done()
  })

  t.test('should name and produce segments for router middleware', function(t) {
    var first = route.get('/:first', function firstMiddleware(ctx) {
      ctx.body = 'first'
    })
    app.use(first)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run()
  })

  t.autoend()

  function run(path) {
    server = app.listen(0, function() {
      http.get({
        port: server.address().port,
        path: path || '/123'
      }).end()
    })
  }
})
