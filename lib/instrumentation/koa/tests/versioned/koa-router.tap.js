'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var http = require('http')

utils(tap)

tap.test('koa-router instrumentation', function(t) {
  var helper = null
  var app = null
  var server = null
  var router = null

  t.beforeEach(function(done) {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'koa',
      type: 'web-framework',
      onRequire: require('../../lib/instrumentation')
    })
    helper.registerInstrumentation({
      moduleName: 'koa-router',
      type: 'web-framework',
      onRequire: require('../../lib/router-instrumentation')
    })
    var Koa = require('koa')
    app = new Koa()
    var Router = require('koa-router')
    router = new Router()
    done()
  })

  t.afterEach(function(done) {
    server.close()
    app = null
    router = null
    helper && helper.unload()
    done()
  })

  t.test('should name and produce segments for router middleware', function(t) {
    router.get('/:first', function firstMiddleware(ctx) {
      ctx.body = 'first'
    })
    app.use(router.routes())
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

  t.test('should name and produce segments for router middleware', function(t) {
    router.param('first', function firstParamware(id, ctx, next) {
      ctx.body = 'first'
      next()
    })
    router.get('/:first', function firstMiddleware(ctx, next) {
      next()
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/[param handler :first]',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/middleware//:first',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstParamware//[param handler :first]'
              }]
            }, {
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first/[param handler :first]',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run()
  })

  t.test('should work for erroring paramware', function(t) {
    router.param('first', function firstParamware() {
      throw new Error('wrong param')
    })
    router.get('/:first', function firstMiddleware() {
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/[param handler :first]',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/middleware//:first',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstParamware//[param handler :first]'
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first/[param handler :first]',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run()
  })

  t.test('should name the transaction after the last responder', function(t) {
    router.get('/:first', function firstMiddleware(ctx, next) {
      ctx.body = 'first'
      next()
    })

    router.get('/:second', function secondMiddleware(ctx) {
      ctx.body += ' second'
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
            }, {
              name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
            }]
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

  t.test('should work with early responding', function(t) {
    router.get('/:first', function firstMiddleware(ctx) {
      ctx.body = 'first'
    })

    router.get('/:second', function secondMiddleware(ctx) {
      ctx.body += ' second'
    })
    app.use(router.routes())
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

  t.test(
    'should name the transaction after the source of the error that occurred',
    function(t) {
      router.get('/:first', function firstMiddleware() {
        throw new Error('☃')
      })

      router.get('/:second', function secondMiddleware(ctx, next) {
        ctx.body += ' second'
        next()
      })

      router.get('/:third', function secondMiddleware() {
      })
      app.use(router.routes())
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
    }
  )

  t.test('should work with multiple routers', function(t) {
    var Router = require('koa-router')
    var router2 = new Router()
    router.get('/:first', function firstMiddleware(ctx, next) {
      ctx.body = 'first'
      next()
    })

    router2.get('/:second', function secondMiddleware(ctx) {
      ctx.body += ' second'
    })
    app.use(router.routes())
    app.use(router2.routes())
    helper.agent.on('transactionFinished', function(tx) {
      // NOTE: due to an implementation detail in koa-compose,
      // sequential middleware will show up as nested. This is due to
      // the dispatch function blocking its returned promise on the
      // resolution of a recursively returned promise.
      // https://github.com/koajs/compose/blob/e754ca3c13e9248b3f453d98ea0b618e09578e2d/index.js#L42-L44
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
            }, {
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
              }]
            }]
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

  t.test('should work with nested routers', function(t) {
    var Router = require('koa-router')
    var router2 = new Router()
    router2.get('/:second', function secondMiddleware(ctx) {
      ctx.body = ' second'
    })
    router.use('/:first', router2.routes())
    app.use(router.routes())
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/secondMiddleware//:first/:second'
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
        'transaction should be named after the middleware responsible for responding'
      )
      t.end()
    })
    run('/123/456/')
  })

  t.test('should work with an array of paths', function(t) {
    router.use(['/:first', '/:second'], function secondMiddleware(ctx, next) {
      ctx.body += ' second'
      next()
    })
    router.get('/:second', function terminalMiddleware(ctx) {
      ctx.body = ' second'
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', function(tx) {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/secondMiddleware//:first'
            }, {
              name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
            }, {
              name: 'Nodejs/Middleware/Koa/terminalMiddleware//:second'
            }]
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
