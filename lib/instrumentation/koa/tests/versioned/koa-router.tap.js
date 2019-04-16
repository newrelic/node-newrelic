'use strict'

var tap = require('tap')
var utils = require('@newrelic/test-utilities')
var semver = require('semver')
var http = require('http')

utils(tap)

tap.test('koa-router instrumentation', function(t) {
  var helper = null
  var app = null
  var server = null
  var router = null
  let Router = null
  var paramMiddlewareName
  if (semver.satisfies(process.version, '>=6.0.0')) {
    paramMiddlewareName = 'Nodejs/Middleware/Koa/middleware//:first'
  } else {
    paramMiddlewareName = 'Nodejs/Middleware/Koa/<anonymous>//:first'
  }

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
    Router = require('koa-router')
    router = new Router()
    done()
  })

  t.afterEach(function(done) {
    server.close()
    app = null
    router = null
    Router = null
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
        'transaction should be named after the matched path'
      )
      t.end()
    })
    run()
  })

  t.test('should name and produce segments with router paramware', (t) => {
    router.param('first', function firstParamware(id, ctx, next) {
      ctx.body = 'first'
      return next()
    })
    router.get('/:first', function firstMiddleware(ctx, next) {
      return next()
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: paramMiddlewareName,
              children: [{
                name: 'Nodejs/Middleware/Koa/firstParamware//[param handler :first]',
                children: [{
                  name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
                }]
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the matched path'
      )
      t.end()
    })
    run()
  })

  t.test('should name transaction after matched path with erroring parameware', (t) => {
    router.param('first', function firstParamware() {
      throw new Error('wrong param')
    })
    router.get('/:first', function firstMiddleware() {})

    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: paramMiddlewareName,
              children: [{
                name: 'Nodejs/Middleware/Koa/firstParamware//[param handler :first]'
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      const errors = helper.agent.errors.errors
      t.equal(errors.length, 1, 'the error has been recorded')
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the matched path'
      )
      t.end()
    })
    run()
  })

  t.test('should name the transaction after the first matched path (layer)', (t) => {
    router.get('/:first', function firstMiddleware(ctx, next) {
      ctx.body = 'first'
      return next().then(function someMoreContent() {
        ctx.body = 'but really first'
      })
    })
    // This path would also match, if it were registered first
    router.get('/:second', function secondMiddleware(ctx) {
      ctx.body += ' second'
    })

    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
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
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the matched path'
      )
      t.end()
    })
    run()
  })

  t.test('transaction name should not be named after error handling middleware', (t) => {
    app.use(function errorHandler(ctx, next) {
      return next().catch((err) => {
        ctx.body = { err: err.message }
      })
    })

    router.get('/:first', function firstMiddleware(ctx) {
      ctx.throw(400, '☃')
    })

    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Nodejs/Middleware/Koa/errorHandler',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      const errors = helper.agent.errors.errors
      t.equal(errors.length, 0, 'should not record error')
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the matched layer path'
      )
      t.end()
    })
    run()
  })

  t.test('transaction name should not be affected by unhandled error', (t) => {
    app.use(function errorHandler(ctx, next) {
      return next()
    })

    router.get('/:first', function firstMiddleware(ctx) {
      ctx.throw(400, '☃')
    })

    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Nodejs/Middleware/Koa/errorHandler',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      const errors = helper.agent.errors.errors
      t.equal(errors.length, 1, 'error should be recorded')
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the matched layer path'
      )
      t.end()
    })
    run()
  })

  t.test('should name transaction after first route for identical matches', (t) => {
    Router = require('koa-router')
    const router2 = new Router()
    router.get('/:first', function firstMiddleware(ctx, next) {
      ctx.body = 'first'
      return next()
    })

    router2.get('/:second', function secondMiddleware(ctx) {
      ctx.body += ' second'
    })
    app.use(router.routes())
    app.use(router2.routes())
    helper.agent.on('transactionFinished', (tx) => {
      // NOTE: due to an implementation detail in koa-compose,
      // sequential middleware will show up as nested. This is due to
      // the dispatch function blocking its returned promise on the
      // resolution of a recursively returned promise.
      // https://github.com/koajs/compose/blob/e754ca3c13e9248b3f453d98ea0b618e09578e2d/index.js#L42-L44
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                }]
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first',
        'transaction should be named after the most specific matched path'
      )
      t.end()
    })
    run()
  })

  t.test('should name tx after most specific route even if body not set', (t) => {
    Router = require('koa-router')
    const router2 = new Router()
    router.get('/:first', function firstMiddleware(ctx, next) {
      ctx.body = 'first'
      return next()
    })

    router2.get('/second', function secondMiddleware() {})
    app.use(router.routes())
    app.use(router2.routes())
    helper.agent.on('transactionFinished', (tx) => {
      // NOTE: due to an implementation detail in koa-compose,
      // sequential middleware will show up as nested. This is due to
      // the dispatch function blocking its returned promise on the
      // resolution of a recursively returned promise.
      // https://github.com/koajs/compose/blob/e754ca3c13e9248b3f453d98ea0b618e09578e2d/index.js#L42-L44
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//second'
                }]
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//second',
        'transaction should be named after the most specific matched path'
      )
      t.end()
    })
    run('/second')
  })

  t.test('should name after most specific path in nested router', (t) => {
    var router2 = new Router()
    router2.get('/:second', function secondMiddleware(ctx) {
      ctx.body = ' second'
    })
    router.use('/:first', router2.routes())
    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
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
        'transaction should be named after the most specific matched path'
      )
      t.end()
    })
    run('/123/456/')
  })

  t.test('should name transaction after most specific layer with array of paths', (t) => {
    // This will register the same middleware (i.e. secondMiddleware)
    // under both the /:first and /:second routes.
    router.use(['/:first', '/:second'], function secondMiddleware(ctx, next) {
      ctx.body += ' second'
      return next()
    })
    router.get('/:second', function terminalMiddleware(ctx) {
      ctx.body = ' second'
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          children: [{
            name: 'Koa/Router: /',
            children: [{
              name: 'Nodejs/Middleware/Koa/secondMiddleware//:first',
              children: [{
                name: 'Nodejs/Middleware/Koa/secondMiddleware//:second',
                children: [{
                  name: 'Nodejs/Middleware/Koa/terminalMiddleware//:second'
                }]
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:second',
        'transaction should be named after the most specific matched path'
      )
      t.end()
    })
    run()
  })

  t.test('names transaction (not found) with array of paths and no handler', (t) => {
    // This will register the same middleware (i.e. secondMiddleware)
    // under both the /:first and /:second routes.
    router.use(['/:first', '/:second'], function secondMiddleware(ctx, next) {
      ctx.body += ' second'
      return next()
    })
    app.use(router.routes())
    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
          children: [{
            name: 'Koa/Router: /'
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
        'transaction should be named (not found)'
      )
      t.end()
    })
    run()
  })

  t.test('app-level middleware should not rename tx from nested router', (t) => {
    app.use(function appLevelMiddleware(ctx, next) {
      return next().then(() => {
        ctx.body = 'do not want this to set the name'
      })
    })

    const nestedRouter = new Router()
    nestedRouter.get('/:second', function terminalMiddleware(ctx) {
      ctx.body = 'want this to set the name'
    })
    nestedRouter.get('/second', function secondMiddleware(ctx) {
      ctx.body = 'this is a test'
    })
    router.use('/:first', nestedRouter.routes())
    app.use(router.routes())

    helper.agent.on('transactionFinished', (tx) => {
      t.exactSegments(
        tx.trace.root, [{
          name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
          children: [{
            name: 'Nodejs/Middleware/Koa/appLevelMiddleware',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/terminalMiddleware//:first/:second'
              }]
            }]
          }]
        }],
        'should have expected segments'
      )
      t.equal(
        tx.name,
        'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
        'should be named after the middleware responsible for originally responding'
      )
      t.end()
    })
    run('/123/second')
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
