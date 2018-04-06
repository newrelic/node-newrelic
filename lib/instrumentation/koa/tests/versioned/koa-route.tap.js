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
      onRequire: require('../../lib/route-instrumentation')
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

  t.test('should name and produce segments for koa-route middleware', function(t) {
    var first = route.get('/resource', function firstMiddleware(ctx) {
      ctx.body = 'hello'
    })
    app.use(first)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//resource',
          children: [{
            name: 'Nodejs/Middleware/Koa/firstMiddleware//resource'
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run('/resource')
  })

  t.test('should name the transaction after the last responder', function(t) {
    var first = route.get('/:first', function firstMiddleware(ctx, param, next) {
      ctx.body = 'first'
      return next()
    })
    var second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          children: [{
            name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
            children: [
              {
                name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
              }
            ]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run()
  })

  t.test('should name the transaction properly when responding after next', function(t) {
    var first = route.get('/:first', function firstMiddleware(ctx, param, next) {
      return next().then(function respond() {
        ctx.body = 'first'
      })
    })
    var second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
            children: [
              {
                name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
              }
            ]
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

  t.test('should work with early responding', function(t) {
    var first = route.get('/:first', function firstMiddleware(ctx) {
      ctx.body = 'first'
      return Promise.resolve()
    })
    var second = route.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })
    app.use(first)
    app.use(second)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
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

  t.test(
    'should name the transaction after the source of the error that occurred',
    function(t) {
      var first = route.get('/:first', function firstMiddleware(ctx, param, next) {
        return next()
      })
      var second = route.get('/:second', function secondMiddleware() {
        throw new Error('some error')
      })
      app.use(first)
      app.use(second)
      helper.agent.on('transactionFinished', function(tx) {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
              children: [
                {
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                }
              ]
            }]
          }],
          'should have expected segments'
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the middleware responsible for responding'
        )
        t.end()
      })
      run()
    })

  t.test('should work properly when used along with non-route middleware', function(t) {
    var first = function firstMiddleware(ctx, next) {
      return next()
    }
    var second = route.get('/resource', function secondMiddleware(ctx, next) {
      ctx.body = 'hello'
      return next()
    })
    var third = function thirdMiddleware(ctx, next) {
      return next()
    }
    app.use(first)
    app.use(second)
    app.use(third)
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//resource',
          children: [{
            name: 'Nodejs/Middleware/Koa/firstMiddleware',
            children: [
              {
                name: 'Nodejs/Middleware/Koa/secondMiddleware//resource',
                children: [
                  {
                    name: 'Nodejs/Middleware/Koa/thirdMiddleware'
                  }
                ]
              }
            ]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//resource',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run('/resource')
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
