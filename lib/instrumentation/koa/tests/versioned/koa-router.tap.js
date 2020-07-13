/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const http = require('http')

utils(tap)

tap.test('koa-router instrumentation', (t) => {
  let helper = null
  let app = null
  let server = null
  let router = null
  let Router = null

  const paramMiddlewareName = 'Nodejs/Middleware/Koa/middleware//:first'

  function testSetup(done) {
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
    const Koa = require('koa')
    app = new Koa()
    Router = require('koa-router')
    router = new Router()
    done()
  }

  function tearDown(done) {
    server.close(() => {
      app = null
      router = null
      Router = null
      helper && helper.unload()

      server = null

      done()
    })
  }

  t.test('with single router', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name and produce segments for matched path', (t) => {
      router.get(
        '/:first',
        function firstMiddleware(ctx, next) {
          next().then(() => {
            ctx.body = 'first'
          })
        },
        function secondMiddleware(ctx) {
          ctx.body = 'second'
        }
      )

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
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:first'
                }]
              }]
            }]
          }]
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

    t.test('should name after matched path using middleware() alias', (t) => {
      router.get('/:first', function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.middleware())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
              }]
            }]
          }]
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

    t.test('should name and produce segments for matched regex path', (t) => {
      router.get(/.*rst$/, function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//.*rst$/'
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
          'transaction should be named after the matched regex pattern'
        )
        t.end()
      })
      run('/first')
    })

    t.test('should name and produce segments for matched wildcard path', (t) => {
      router.get('/:first/(.*)', function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first/(.*)'
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
          'transaction should be named after the matched regex path'
        )
        t.end()
      })
      run('/123/456')
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
          }]
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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

    t.test('should name the transaction after the last matched path (layer)', (t) => {
      router.get('/:first', function firstMiddleware(ctx, next) {
        ctx.body = 'first'
        return next().then(function someMoreContent() {
          ctx.body = 'first'
        })
      })
      router.get('/:second', function secondMiddleware(ctx) {
        ctx.body += ' second'
      })

      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
                children: [{
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                }]
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the matched path'
        )
        t.end()
      })
      run()
    })

    t.test('tx name should not be named after error handling middleware', (t) => {
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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

    t.test('should name tx after route declarations with supported http methods', (t) => {
      // This will register the same middleware (i.e. secondMiddleware)
      // under both the /:first and /:second routes. Use does not register middleware
      // w/ supported methods they cannot handle routes.
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the last matched path'
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
          }]
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

    t.test(
      'names tx (not found) when no matching route and base middleware does not set body',
      (t) => {
        app.use(function baseMiddleware(ctx, next) {
          next()
        })

        // This will register the same middleware (i.e. secondMiddleware)
        // under both the /:first and /:second routes.
        router.get('/first', function secondMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              children: [{
                name: 'Nodejs/Middleware/Koa/baseMiddleware',
                children: [{
                  name: 'Koa/Router: /'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            'transaction should be named (not found)'
          )
          t.end()
        })
        run('/')
      }
    )
  })

  t.test('using multipler routers', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name transaction after last route for identical matches', (t) => {
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
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
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
          }]
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

    t.test('should name tx after last matched route even if body not set', (t) => {
      Router = require('koa-router')
      const router2 = new Router()
      router.get('/first', function firstMiddleware(ctx, next) {
        ctx.body = 'first'
        return next()
      })

      router2.get('/:second', function secondMiddleware() {})
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
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//first',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                  }]
                }]
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the last matched path'
        )
        t.end()
      })
      run('/first')
    })
  })

  t.test('using nested or prefixed routers', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name after most last matched path', (t) => {
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
          'transaction should be named after the last matched path'
        )
        t.end()
      })
      run('/123/456/')
    })

    t.test('app-level middleware should not rename tx from matched path', (t) => {
      app.use(function appLevelMiddleware(ctx, next) {
        return next().then(() => {
          ctx.body = 'do not want this to set the name'
        })
      })

      const nestedRouter = new Router()
      nestedRouter.get('/:second', function terminalMiddleware(ctx) {
        ctx.body = 'this is a test'
      })
      nestedRouter.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'want this to set the name'
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
          'should be named after last matched route'
        )
        t.end()
      })
      run('/123/second')
    })

    t.test('app-level middleware should not rename tx from matched prefix path', (t) => {
      app.use(function appLevelMiddleware(ctx, next) {
        return next().then(() => {
          ctx.body = 'do not want this to set the name'
        })
      })

      router.get('/:second', function terminalMiddleware(ctx) {
        ctx.body = 'this is a test'
      })
      router.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'want this to set the name'
      })
      router.prefix('/:first')
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
          'should be named after the last matched path'
        )
        t.end()
      })
      run('/123/second')
    })
  })

  t.test('using allowedMethods', (t) => {
    t.autoend()

    t.test('with throw: true', (t) => {
      t.beforeEach((done) => testSetup(done))
      t.afterEach((done) => tearDown(done))
      t.autoend()

      t.test('should name transaction after status `method now allowed` message', (t) => {
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name transaction after status `not implemented` message', (t) => {
        router = new Router({ methods: ['POST'] })
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )

          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('error handler normalizes tx name if body is reset without status', (t) => {
        app.use(function errorHandler(ctx, next) {
          return next().catch(() => {
            // resetting the body without manually persisting ctx.status
            // results in status 200
            ctx.body = { msg: 'error is handled' }
          })
        })

        const nestedRouter = new Router()
        nestedRouter.post('/:second', function terminalMiddleware(ctx) {
          ctx.body = 'would want this to set name if verb were correct'
        })
        router.use('/:first', nestedRouter.routes(), nestedRouter.allowedMethods())
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/NormalizedUri/*',
              children: [{
                name: 'Nodejs/Middleware/Koa/errorHandler',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/NormalizedUri/*',
            'should have normalized transaction name'
          )
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 0, 'error should not be recorded')
          t.end()
        })
        run('/123/456')
      })

      t.test(
        'should name tx after status message when base middleware does not set body',
        (t) => {
          // Because allowedMethods throws & no user catching, it is considered
          // unhandled and will push the base route back on
          app.use(function baseMiddleware(ctx, next) {
            return next()
            // does not set ctx.body or ctx.status
          })

          const nestedRouter = new Router()
          nestedRouter.post('/:second', function terminalMiddleware(ctx) {
            ctx.body = 'would want this to set name if verb were correct'
          })
          router.use('/:first', nestedRouter.routes(), nestedRouter.allowedMethods())
          app.use(router.routes())
          app.use(router.allowedMethods({throw: true}))

          helper.agent.on('transactionFinished', (tx) => {
            t.exactSegments(
              tx.trace.root, [{
                name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                children: [{
                  name: 'Nodejs/Middleware/Koa/baseMiddleware',
                  children: [{
                    name: 'Koa/Router: /',
                    children: [{
                      name: 'Nodejs/Middleware/Koa/allowedMethods'
                    }]
                  }]
                }]
              }]
            )
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'should name after returned status code'
            )
            const errors = helper.agent.errors.eventAggregator
            t.equal(errors.length, 1, 'should notice thrown error')

            t.end()
          })
          run('/123/456')
        }
      )
    })

    t.test('with throw: false', (t) => {
      t.beforeEach((done) => testSetup(done))
      t.afterEach((done) => tearDown(done))
      t.autoend()

      t.test('should name transaction after status `method now allowed` message', (t) => {
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          // Agent will automatically create error for 405 status code.
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name transaction after status `not implemented` message', (t) => {
        router = new Router({ methods: ['POST'] })
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )
          // Agent will automatically create error for 501 status code.
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name tx after `method not allowed` with prefixed router', (t) => {
        app.use(function appLevelMiddleware(ctx, next) {
          return next().then(() => {
            ctx.body = 'should not set the name'
          })
        })
        router.post('/second', function secondMiddleware(ctx) {
          ctx.body = 'should not set the name'
        })
        router.prefix('/:first')
        app.use(router.routes())
        app.use(router.allowedMethods())

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Nodejs/Middleware/Koa/appLevelMiddleware',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          t.end()
        })
        run('/123/second')
      })

      t.test('should name tx after `not implemented` with prefixed router', (t) => {
        router = new Router({ methods: ['POST'] })

        app.use(function appLevelMiddleware(ctx, next) {
          return next().then(() => {
            ctx.body = 'should not set the name'
          })
        })
        router.post('/second', function secondMiddleware(ctx) {
          ctx.body = 'should not set the name'
        })
        router.prefix('/:first')
        app.use(router.routes())
        app.use(router.allowedMethods())

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Nodejs/Middleware/Koa/appLevelMiddleware',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )
          t.end()
        })
        run('/123/first')
      })

      t.test('should name and produce segments for existing matched path', (t) => {
        router = new Router({ methods: ['GET'] })
        router.get('/:first', function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
                }]
              }]
            }]
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
    })
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

tap.test('@koa/router instrumentation', (t) => {
  let helper = null
  let app = null
  let server = null
  let router = null
  let Router = null

  const paramMiddlewareName = 'Nodejs/Middleware/Koa/middleware//:first'

  function testSetup(done) {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'koa',
      type: 'web-framework',
      onRequire: require('../../lib/instrumentation')
    })
    helper.registerInstrumentation({
      moduleName: '@koa/router',
      type: 'web-framework',
      onRequire: require('../../lib/router-instrumentation')
    })
    const Koa = require('koa')
    app = new Koa()
    Router = require('@koa/router')
    router = new Router()
    done()
  }

  function tearDown(done) {
    server.close(() => {
      app = null
      router = null
      Router = null
      helper && helper.unload()

      server = null

      done()
    })
  }

  t.test('with single router', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name and produce segments for matched path', (t) => {
      router.get(
        '/:first',
        function firstMiddleware(ctx, next) {
          next().then(() => {
            ctx.body = 'first'
          })
        },
        function secondMiddleware(ctx) {
          ctx.body = 'second'
        }
      )

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
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:first'
                }]
              }]
            }]
          }]
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

    t.test('should name after matched path using middleware() alias', (t) => {
      router.get('/:first', function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.middleware())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
              }]
            }]
          }]
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

    t.test('should name and produce segments for matched regex path', (t) => {
      router.get(/.*rst$/, function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//.*rst$/'
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
          'transaction should be named after the matched regex pattern'
        )
        t.end()
      })
      run('/first')
    })

    t.test('should name and produce segments for matched wildcard path', (t) => {
      router.get('/:first/(.*)', function firstMiddleware(ctx) {
        ctx.body = 'first'
      })
      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first/(.*)'
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
          'transaction should be named after the matched regex path'
        )
        t.end()
      })
      run('/123/456')
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
          }]
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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

    t.test('should name the transaction after the last matched path (layer)', (t) => {
      router.get('/:first', function firstMiddleware(ctx, next) {
        ctx.body = 'first'
        return next().then(function someMoreContent() {
          ctx.body = 'first'
        })
      })
      router.get('/:second', function secondMiddleware(ctx) {
        ctx.body += ' second'
      })

      app.use(router.routes())
      helper.agent.on('transactionFinished', (tx) => {
        t.exactSegments(
          tx.trace.root, [{
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//:first',
                children: [{
                  name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                }]
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the matched path'
        )
        t.end()
      })
      run()
    })

    t.test('tx name should not be named after error handling middleware', (t) => {
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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
          }]
        )
        const errors = helper.agent.errors.eventAggregator
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

    t.test('should name tx after route declarations with supported http methods', (t) => {
      // This will register the same middleware (i.e. secondMiddleware)
      // under both the /:first and /:second routes. Use does not register middleware
      // w/ supported methods they cannot handle routes.
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the last matched path'
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
          }]
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

    t.test(
      'names tx (not found) when no matching route and base middleware does not set body',
      (t) => {
        app.use(function baseMiddleware(ctx, next) {
          next()
        })

        // This will register the same middleware (i.e. secondMiddleware)
        // under both the /:first and /:second routes.
        router.get('/first', function secondMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              children: [{
                name: 'Nodejs/Middleware/Koa/baseMiddleware',
                children: [{
                  name: 'Koa/Router: /'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            'transaction should be named (not found)'
          )
          t.end()
        })
        run('/')
      }
    )
  })

  t.test('using multipler routers', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name transaction after last route for identical matches', (t) => {
      Router = require('@koa/router')
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
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
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
          }]
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

    t.test('should name tx after last matched route even if body not set', (t) => {
      Router = require('@koa/router')
      const router2 = new Router()
      router.get('/first', function firstMiddleware(ctx, next) {
        ctx.body = 'first'
        return next()
      })

      router2.get('/:second', function secondMiddleware() {})
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
            name: 'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            children: [{
              name: 'Koa/Router: /',
              children: [{
                name: 'Nodejs/Middleware/Koa/firstMiddleware//first',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/secondMiddleware//:second'
                  }]
                }]
              }]
            }]
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:second',
          'transaction should be named after the last matched path'
        )
        t.end()
      })
      run('/first')
    })
  })

  t.test('using nested or prefixed routers', (t) => {
    t.beforeEach((done) => testSetup(done))
    t.afterEach((done) => tearDown(done))
    t.autoend()

    t.test('should name after most last matched path', (t) => {
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
          'transaction should be named after the last matched path'
        )
        t.end()
      })
      run('/123/456/')
    })

    t.test('app-level middleware should not rename tx from matched path', (t) => {
      app.use(function appLevelMiddleware(ctx, next) {
        return next().then(() => {
          ctx.body = 'do not want this to set the name'
        })
      })

      const nestedRouter = new Router()
      nestedRouter.get('/:second', function terminalMiddleware(ctx) {
        ctx.body = 'this is a test'
      })
      nestedRouter.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'want this to set the name'
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
          'should be named after last matched route'
        )
        t.end()
      })
      run('/123/second')
    })

    t.test('app-level middleware should not rename tx from matched prefix path', (t) => {
      app.use(function appLevelMiddleware(ctx, next) {
        return next().then(() => {
          ctx.body = 'do not want this to set the name'
        })
      })

      router.get('/:second', function terminalMiddleware(ctx) {
        ctx.body = 'this is a test'
      })
      router.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'want this to set the name'
      })
      router.prefix('/:first')
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
          }]
        )
        t.equal(
          tx.name,
          'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
          'should be named after the last matched path'
        )
        t.end()
      })
      run('/123/second')
    })
  })

  t.test('using allowedMethods', (t) => {
    t.autoend()

    t.test('with throw: true', (t) => {
      t.beforeEach((done) => testSetup(done))
      t.afterEach((done) => tearDown(done))
      t.autoend()

      t.test('should name transaction after status `method now allowed` message', (t) => {
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name transaction after status `not implemented` message', (t) => {
        router = new Router({ methods: ['POST'] })
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )

          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('error handler normalizes tx name if body is reset without status', (t) => {
        app.use(function errorHandler(ctx, next) {
          return next().catch(() => {
            // resetting the body without manually persisting ctx.status
            // results in status 200
            ctx.body = { msg: 'error is handled' }
          })
        })

        const nestedRouter = new Router()
        nestedRouter.post('/:second', function terminalMiddleware(ctx) {
          ctx.body = 'would want this to set name if verb were correct'
        })
        router.use('/:first', nestedRouter.routes(), nestedRouter.allowedMethods())
        app.use(router.routes())
        app.use(router.allowedMethods({throw: true}))

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/NormalizedUri/*',
              children: [{
                name: 'Nodejs/Middleware/Koa/errorHandler',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/NormalizedUri/*',
            'should have normalized transaction name'
          )
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 0, 'error should not be recorded')
          t.end()
        })
        run('/123/456')
      })

      t.test(
        'should name tx after status message when base middleware does not set body',
        (t) => {
          // Because allowedMethods throws & no user catching, it is considered
          // unhandled and will push the base route back on
          app.use(function baseMiddleware(ctx, next) {
            return next()
            // does not set ctx.body or ctx.status
          })

          const nestedRouter = new Router()
          nestedRouter.post('/:second', function terminalMiddleware(ctx) {
            ctx.body = 'would want this to set name if verb were correct'
          })
          router.use('/:first', nestedRouter.routes(), nestedRouter.allowedMethods())
          app.use(router.routes())
          app.use(router.allowedMethods({throw: true}))

          helper.agent.on('transactionFinished', (tx) => {
            t.exactSegments(
              tx.trace.root, [{
                name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                children: [{
                  name: 'Nodejs/Middleware/Koa/baseMiddleware',
                  children: [{
                    name: 'Koa/Router: /',
                    children: [{
                      name: 'Nodejs/Middleware/Koa/allowedMethods'
                    }]
                  }]
                }]
              }]
            )
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'should name after returned status code'
            )
            const errors = helper.agent.errors.eventAggregator
            t.equal(errors.length, 1, 'should notice thrown error')

            t.end()
          })
          run('/123/456')
        }
      )
    })

    t.test('with throw: false', (t) => {
      t.beforeEach((done) => testSetup(done))
      t.afterEach((done) => tearDown(done))
      t.autoend()

      t.test('should name transaction after status `method now allowed` message', (t) => {
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          // Agent will automatically create error for 405 status code.
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name transaction after status `not implemented` message', (t) => {
        router = new Router({ methods: ['POST'] })
        router.post('/:first', function firstMiddleware() {})
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/allowedMethods'
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )
          // Agent will automatically create error for 501 status code.
          const errors = helper.agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.end()
        })
        run()
      })

      t.test('should name tx after `method not allowed` with prefixed router', (t) => {
        app.use(function appLevelMiddleware(ctx, next) {
          return next().then(() => {
            ctx.body = 'should not set the name'
          })
        })
        router.post('/second', function secondMiddleware(ctx) {
          ctx.body = 'should not set the name'
        })
        router.prefix('/:first')
        app.use(router.routes())
        app.use(router.allowedMethods())

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              children: [{
                name: 'Nodejs/Middleware/Koa/appLevelMiddleware',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
            'transaction should be named after corresponding status code message'
          )
          t.end()
        })
        run('/123/second')
      })

      t.test('should name tx after `not implemented` with prefixed router', (t) => {
        router = new Router({ methods: ['POST'] })

        app.use(function appLevelMiddleware(ctx, next) {
          return next().then(() => {
            ctx.body = 'should not set the name'
          })
        })
        router.post('/second', function secondMiddleware(ctx) {
          ctx.body = 'should not set the name'
        })
        router.prefix('/:first')
        app.use(router.routes())
        app.use(router.allowedMethods())

        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              children: [{
                name: 'Nodejs/Middleware/Koa/appLevelMiddleware',
                children: [{
                  name: 'Koa/Router: /',
                  children: [{
                    name: 'Nodejs/Middleware/Koa/allowedMethods'
                  }]
                }]
              }]
            }]
          )
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
            'transaction should be named after corresponding status code message'
          )
          t.end()
        })
        run('/123/first')
      })

      t.test('should name and produce segments for existing matched path', (t) => {
        router = new Router({ methods: ['GET'] })
        router.get('/:first', function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        app.use(router.allowedMethods())
        helper.agent.on('transactionFinished', (tx) => {
          t.exactSegments(
            tx.trace.root, [{
              name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              children: [{
                name: 'Koa/Router: /',
                children: [{
                  name: 'Nodejs/Middleware/Koa/firstMiddleware//:first'
                }]
              }]
            }]
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
    })
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
