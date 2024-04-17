/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = (pkg) => {
  const tap = require('tap')
  require('../../lib/metrics_helper')
  const helper = require('../../lib/agent_helper')
  const semver = require('semver')
  const { run } = require('./utils')

  tap.test(`${pkg} instrumentation`, (t) => {
    const { version: pkgVersion } = require(`${pkg}/package.json`)
    const paramMiddlewareName = 'Nodejs/Middleware/Koa/middleware//:first'

    /**
     * Helper to decide how to name nested route segments
     * This diverged in 8.0.2 and we decided not to fix.
     * Instead of pinning the routers to a very old version we unleashed
     * and handle the differences.
     *
     * See original issue: https://github.com/newrelic/node-newrelic-koa/issues/35
     */
    function getNestedSpanName(mwName) {
      let spanName = `Nodejs/Middleware/Koa/${mwName}/`
      if (semver.gte(pkgVersion, '8.0.2')) {
        spanName += '/:second'
      } else {
        spanName += '/:first/:second'
      }
      return spanName
    }

    function testSetup(t) {
      t.context.agent = helper.instrumentMockedAgent()

      const Koa = require('koa')
      t.context.app = new Koa()
      const Router = require(pkg)
      t.context.router = new Router()
      t.context.Router = Router
    }

    function tearDown(t) {
      t.context.server.close()
      helper.unloadAgent(t.context.agent)
    }

    t.test('with single router', (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)
      t.autoend()

      t.test('should name and produce segments for matched path', (t) => {
        const { agent, router, app } = t.context
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
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Nodejs/Middleware/Koa/secondMiddleware//:first']
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name after matched path using middleware() alias', (t) => {
        const { agent, router, app } = t.context
        router.get('/:first', function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.middleware())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should handle transaction state loss', (t) => {
        const { agent, router, app } = t.context
        let savedCtx = null
        router.get('/:any', (ctx) => {
          savedCtx = ctx
        })
        app.use(router.middleware())
        agent.on('transactionFinished', () => {
          t.doesNotThrow(() => (savedCtx._matchedRoute = 'test'))
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name and produce segments for matched regex path', (t) => {
        const { agent, router, app } = t.context
        router.get(/.*rst$/, function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//.*rst$/']]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            'transaction should be named after the matched regex pattern'
          )
          t.end()
        })
        run({ path: '/first', context: t.context })
      })

      t.test('should name and produce segments for matched wildcard path', (t) => {
        const { agent, router, app } = t.context
        router.get('/:first/(.*)', function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
            ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first/(.*)']]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/(.*)',
            'transaction should be named after the matched regex path'
          )
          t.end()
        })
        run({ path: '/123/456', context: t.context })
      })

      t.test('should name and produce segments with router paramware', (t) => {
        const { agent, router, app } = t.context
        router.param('first', function firstParamware(id, ctx, next) {
          ctx.body = 'first'
          return next()
        })
        router.get('/:first', function firstMiddleware(ctx, next) {
          return next()
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Koa/Router: /',
              [
                paramMiddlewareName,
                [
                  'Nodejs/Middleware/Koa/firstParamware//[param handler :first]',
                  ['Nodejs/Middleware/Koa/firstMiddleware//:first']
                ]
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name transaction after matched path with erroring parameware', (t) => {
        const { agent, router, app } = t.context
        router.param('first', function firstParamware() {
          throw new Error('wrong param')
        })
        router.get('/:first', function firstMiddleware() {})

        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Koa/Router: /',
              [
                paramMiddlewareName,
                ['Nodejs/Middleware/Koa/firstParamware//[param handler :first]']
              ]
            ]
          ])
          const errors = agent.errors.eventAggregator
          t.equal(errors.length, 1, 'the error has been recorded')
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name the transaction after the last matched path (layer)', (t) => {
        const { agent, router, app } = t.context
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
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Nodejs/Middleware/Koa/secondMiddleware//:second']
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('tx name should not be named after error handling middleware', (t) => {
        const { agent, router, app } = t.context
        app.use(function errorHandler(ctx, next) {
          return next().catch((err) => {
            ctx.body = { err: err.message }
          })
        })

        router.get('/:first', function firstMiddleware(ctx) {
          ctx.throw(400, '☃')
        })

        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Nodejs/Middleware/Koa/errorHandler',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ]
          ])
          const errors = agent.errors.eventAggregator
          t.equal(errors.length, 0, 'should not record error')
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched layer path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('transaction name should not be affected by unhandled error', (t) => {
        const { agent, router, app } = t.context
        app.use(function errorHandler(ctx, next) {
          return next()
        })

        router.get('/:first', function firstMiddleware(ctx) {
          ctx.throw(400, '☃')
        })

        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Nodejs/Middleware/Koa/errorHandler',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ]
          ])
          const errors = agent.errors.eventAggregator
          t.equal(errors.length, 1, 'error should be recorded')
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched layer path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name tx after route declarations with supported http methods', (t) => {
        const { agent, router, app } = t.context
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
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/secondMiddleware//:first',
                [
                  'Nodejs/Middleware/Koa/secondMiddleware//:second',
                  ['Nodejs/Middleware/Koa/terminalMiddleware//:second']
                ]
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the last matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('names transaction (not found) with array of paths and no handler', (t) => {
        const { agent, router, app } = t.context
        // This will register the same middleware (i.e. secondMiddleware)
        // under both the /:first and /:second routes.
        router.use(['/:first', '/:second'], function secondMiddleware(ctx, next) {
          ctx.body += ' second'
          return next()
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            ['Koa/Router: /']
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            'transaction should be named (not found)'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test(
        'names tx (not found) when no matching route and base middleware does not set body',
        (t) => {
          const { agent, router, app } = t.context
          app.use(function baseMiddleware(ctx, next) {
            next()
          })

          // This will register the same middleware (i.e. secondMiddleware)
          // under both the /:first and /:second routes.
          router.get('/first', function secondMiddleware(ctx) {
            ctx.body = 'first'
          })
          app.use(router.routes())
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              ['Nodejs/Middleware/Koa/baseMiddleware', ['Koa/Router: /']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              'transaction should be named (not found)'
            )
            t.end()
          })
          run({ path: '/', context: t.context })
        }
      )
    })

    t.test('using multipler routers', (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)
      t.autoend()

      t.test('should name transaction after last route for identical matches', (t) => {
        const { agent, router, app } = t.context
        const Router = require(pkg)
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
        agent.on('transactionFinished', (tx) => {
          // NOTE: due to an implementation detail in koa-compose,
          // sequential middleware will show up as nested. This is due to
          // the dispatch function blocking its returned promise on the
          // resolution of a recursively returned promise.
          // https://github.com/koajs/compose/blob/e754ca3c13e9248b3f453d98ea0b618e09578e2d/index.js#L42-L44
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/secondMiddleware//:second']]
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the most specific matched path'
          )
          t.end()
        })
        run({ context: t.context })
      })

      t.test('should name tx after last matched route even if body not set', (t) => {
        const { agent, router, app } = t.context
        const Router = require(pkg)
        const router2 = new Router()
        router.get('/first', function firstMiddleware(ctx, next) {
          ctx.body = 'first'
          return next()
        })

        router2.get('/:second', function secondMiddleware() {})
        app.use(router.routes())
        app.use(router2.routes())
        agent.on('transactionFinished', (tx) => {
          // NOTE: due to an implementation detail in koa-compose,
          // sequential middleware will show up as nested. This is due to
          // the dispatch function blocking its returned promise on the
          // resolution of a recursively returned promise.
          // https://github.com/koajs/compose/blob/e754ca3c13e9248b3f453d98ea0b618e09578e2d/index.js#L42-L44
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//first',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/secondMiddleware//:second']]
              ]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the last matched path'
          )
          t.end()
        })
        run({ path: '/first', context: t.context })
      })
    })

    t.test('using nested or prefixed routers', (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)
      t.autoend()

      t.test('should name after most last matched path', (t) => {
        const { agent, router, Router, app } = t.context
        const router2 = new Router()
        router2.get('/:second', function secondMiddleware(ctx) {
          ctx.body = ' second'
        })
        router.use('/:first', router2.routes())
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            ['Koa/Router: /', [getNestedSpanName('secondMiddleware')]]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            'transaction should be named after the last matched path'
          )
          t.end()
        })
        run({ path: '/123/456/', context: t.context })
      })

      t.test('app-level middleware should not rename tx from matched path', (t) => {
        const { agent, router, Router, app } = t.context
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

        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
            [
              'Nodejs/Middleware/Koa/appLevelMiddleware',
              ['Koa/Router: /', [getNestedSpanName('terminalMiddleware')]]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
            'should be named after last matched route'
          )
          t.end()
        })
        run({ path: '/123/second', context: t.context })
      })

      t.test('app-level middleware should not rename tx from matched prefix path', (t) => {
        const { agent, router, app } = t.context
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

        agent.on('transactionFinished', (tx) => {
          t.assertSegments(tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
            [
              'Nodejs/Middleware/Koa/appLevelMiddleware',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/terminalMiddleware//:first/:second']]
            ]
          ])
          t.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/second',
            'should be named after the last matched path'
          )
          t.end()
        })
        run({ path: '/123/second', context: t.context })
      })
    })

    t.test('using allowedMethods', (t) => {
      t.autoend()

      t.test('with throw: true', (t) => {
        t.beforeEach(testSetup)
        t.afterEach(tearDown)
        t.autoend()

        t.test('should name transaction after status `method now allowed` message', (t) => {
          const { agent, router, app } = t.context
          router.post('/:first', function firstMiddleware() {})
          app.use(router.routes())
          app.use(router.allowedMethods({ throw: true }))
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'transaction should be named after corresponding status code message'
            )
            const errors = agent.errors.eventAggregator
            t.equal(errors.length, 1, 'the error has been recorded')
            t.end()
          })
          run({ context: t.context })
        })

        t.test('should name transaction after status `not implemented` message', (t) => {
          const { agent, Router, app } = t.context
          const router = new Router({ methods: ['POST'] })
          router.post('/:first', function firstMiddleware() {})
          app.use(router.routes())
          app.use(router.allowedMethods({ throw: true }))
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )

            const errors = agent.errors.eventAggregator
            t.equal(errors.length, 1, 'the error has been recorded')
            t.end()
          })
          run({ context: t.context })
        })

        t.test('error handler normalizes tx name if body is reset without status', (t) => {
          const { agent, router, Router, app } = t.context
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
          app.use(router.allowedMethods({ throw: true }))

          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/NormalizedUri/*',
              [
                'Nodejs/Middleware/Koa/errorHandler',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
              ]
            ])
            t.equal(
              tx.name,
              'WebTransaction/NormalizedUri/*',
              'should have normalized transaction name'
            )
            const errors = agent.errors.eventAggregator
            t.equal(errors.length, 0, 'error should not be recorded')
            t.end()
          })
          run({ path: '/123/456', context: t.context })
        })

        t.test(
          'should name tx after status message when base middleware does not set body',
          (t) => {
            const { agent, router, Router, app } = t.context
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
            app.use(router.allowedMethods({ throw: true }))

            agent.on('transactionFinished', (tx) => {
              t.assertSegments(tx.trace.root, [
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                [
                  'Nodejs/Middleware/Koa/baseMiddleware',
                  ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
                ]
              ])
              t.equal(
                tx.name,
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                'should name after returned status code'
              )
              const errors = agent.errors.eventAggregator
              t.equal(errors.length, 1, 'should notice thrown error')

              t.end()
            })
            run({ path: '/123/456', context: t.context })
          }
        )
      })

      t.test('with throw: false', (t) => {
        t.beforeEach(testSetup)
        t.afterEach(tearDown)
        t.autoend()

        t.test('should name transaction after status `method now allowed` message', (t) => {
          const { agent, router, app } = t.context
          router.post('/:first', function firstMiddleware() {})
          app.use(router.routes())
          app.use(router.allowedMethods())
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'transaction should be named after corresponding status code message'
            )
            // Agent will automatically create error for 405 status code.
            const errors = agent.errors.eventAggregator
            t.equal(errors.length, 1, 'the error has been recorded')
            t.end()
          })
          run({ context: t.context })
        })

        t.test('should name transaction after status `not implemented` message', (t) => {
          const { agent, app, Router } = t.context
          const router = new Router({ methods: ['POST'] })
          router.post('/:first', function firstMiddleware() {})
          app.use(router.routes())
          app.use(router.allowedMethods())
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )
            // Agent will automatically create error for 501 status code.
            const errors = agent.errors.eventAggregator
            t.equal(errors.length, 1, 'the error has been recorded')
            t.end()
          })
          run({ context: t.context })
        })

        t.test('should name tx after `method not allowed` with prefixed router', (t) => {
          const { agent, router, app } = t.context
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

          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              [
                'Nodejs/Middleware/Koa/appLevelMiddleware',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
              ]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'transaction should be named after corresponding status code message'
            )
            t.end()
          })
          run({ path: '/123/second', context: t.context })
        })

        t.test('should name tx after `not implemented` with prefixed router', (t) => {
          const { agent, app, Router } = t.context
          const router = new Router({ methods: ['POST'] })

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

          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              [
                'Nodejs/Middleware/Koa/appLevelMiddleware',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/allowedMethods']]
              ]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )
            t.end()
          })
          run({ path: '/123/first', context: t.context })
        })

        t.test('should name and produce segments for existing matched path', (t) => {
          const { agent, app, Router } = t.context
          const router = new Router({ methods: ['GET'] })
          router.get('/:first', function firstMiddleware(ctx) {
            ctx.body = 'first'
          })
          app.use(router.routes())
          app.use(router.allowedMethods())
          agent.on('transactionFinished', (tx) => {
            t.assertSegments(tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ])
            t.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              'transaction should be named after the matched path'
            )
            t.end()
          })
          run({ context: t.context })
        })
      })
    })
    t.end()
  })
}
