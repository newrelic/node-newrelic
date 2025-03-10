/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')

/**
 * koa-router and @koa/router updated how they defined wildcard routing
 * It used to be native and then relied on `path-to-regexp`. If `path-to-regexp`
 * is present get the version. For post 8 it relies on different syntax to define
 * routes. If it is not present assume the pre 8 behavior of `path-to-regexp`
 * is the same. Also cannot use require because `path-to-regexp` defines exports
 * and package.json is not a defined export.
 */
function getPathToRegexpVersion() {
  let pathToRegexVersion
  try {
    ;({ version: pathToRegexVersion } = JSON.parse(
      fs.readFileSync(path.join(__dirname, '/node_modules/path-to-regexp/package.json'))
    ))
  } catch {
    pathToRegexVersion = '6.0.0'
  }
  return pathToRegexVersion
}

module.exports = (pkg) => {
  require('../../lib/metrics_helper')
  const helper = require('../../lib/agent_helper')
  const semver = require('semver')
  const { run } = require('./utils')

  test(`${pkg} instrumentation`, async (t) => {
    const { version: pkgVersion } = require(`${pkg}/package.json`)
    const paramMiddlewareName = 'Nodejs/Middleware/Koa/middleware//:first'
    const pathToRegexVersion = getPathToRegexpVersion()

    /**
     * Helper to decide how to name nested route segments
     * This diverged in 8.0.2 and we decided not to fix.
     * Instead of pinning the routers to a very old version we unleashed
     * and handle the differences.
     *
     * See original issue: https://github.com/newrelic/node-newrelic-koa/issues/35
     * @param mwName
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

    function testSetup(ctx) {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()

      const Koa = require('koa')
      ctx.nr.app = new Koa()
      const Router = require(pkg)
      ctx.nr.router = new Router()
      ctx.nr.Router = Router
    }

    function tearDown(ctx) {
      ctx.nr?.server?.close()
      helper.unloadAgent(ctx.nr.agent)
    }

    await t.test('with single router', async (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)

      await t.test('should name and produce segments for matched path', (t, end) => {
        const { agent, router, app } = t.nr
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
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Nodejs/Middleware/Koa/secondMiddleware//:first']
              ]
            ]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          assertSpanKind({
            agent,
            segments: [
              { name: 'WebTransaction/WebFrameworkUri/Koa/GET//:first', kind: 'server' },
              { name: 'Koa/Router: /', kind: 'internal' },
              { name: 'Nodejs/Middleware/Koa/firstMiddleware//:first', kind: 'internal' },
              { name: 'Nodejs/Middleware/Koa/secondMiddleware//:first', kind: 'internal' },
            ]
          })
          end()
        })
        run({ context: t.nr })
      })

      await t.test('should name after matched path using middleware() alias', (t, end) => {
        const { agent, router, app } = t.nr
        router.get('/:first', function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.middleware())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test('should handle transaction state loss', (t, end) => {
        const { agent, router, app } = t.nr
        let savedCtx = null
        router.get('/:any', (ctx) => {
          savedCtx = ctx
        })
        app.use(router.middleware())
        agent.on('transactionFinished', () => {
          assert.doesNotThrow(() => (savedCtx._matchedRoute = 'test'))
          end()
        })
        run({ context: t.nr })
      })

      await t.test('should name and produce segments for matched regex path', (t, end) => {
        const { agent, router, app } = t.nr
        router.get(/.*rst$/, function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//.*rst$/']]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//.*rst$',
            'transaction should be named after the matched regex pattern'
          )
          end()
        })
        run({ path: '/first', context: t.nr })
      })

      await t.test('should name and produce segments for matched wildcard path', (t, end) => {
        const { agent, router, app } = t.nr
        let path = '(.*)'
        if (semver.gte(pathToRegexVersion, '8.0.0')) {
          path = '{*any}'
        }
        router.get(`/:first/${path}`, function firstMiddleware(ctx) {
          ctx.body = 'first'
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            `WebTransaction/WebFrameworkUri/Koa/GET//:first/${path}`,
            ['Koa/Router: /', [`Nodejs/Middleware/Koa/firstMiddleware//:first/${path}`]]
          ])
          assert.equal(
            tx.name,
            `WebTransaction/WebFrameworkUri/Koa/GET//:first/${path}`,
            'transaction should be named after the matched regex path'
          )
          end()
        })
        run({ path: '/123/456', context: t.nr })
      })

      await t.test('should name and produce segments with router paramware', (t, end) => {
        const { agent, router, app } = t.nr
        router.param('first', function firstParamware(id, ctx, next) {
          ctx.body = 'first'
          return next()
        })
        router.get('/:first', function firstMiddleware(ctx, next) {
          return next()
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
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
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test(
        'should name transaction after matched path with erroring parameware',
        (t, end) => {
          const { agent, router, app } = t.nr
          router.param('first', function firstParamware() {
            throw new Error('wrong param')
          })
          router.get('/:first', function firstMiddleware() {})

          app.silent = true
          app.use(router.routes())
          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
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
            assert.equal(errors.length, 1, 'the error has been recorded')
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              'transaction should be named after the matched path'
            )
            end()
          })
          run({ context: t.nr })
        }
      )

      await t.test('should name the transaction after the last matched path (layer)', (t, end) => {
        const { agent, router, app } = t.nr
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
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Nodejs/Middleware/Koa/secondMiddleware//:second']
              ]
            ]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the matched path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test('tx name should not be named after error handling middleware', (t, end) => {
        const { agent, router, app } = t.nr
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
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Nodejs/Middleware/Koa/errorHandler',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ]
          ])
          const errors = agent.errors.eventAggregator
          assert.equal(errors.length, 0, 'should not record error')
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched layer path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test('transaction name should not be affected by unhandled error', (t, end) => {
        const { agent, router, app } = t.nr
        app.use(function errorHandler(ctx, next) {
          return next()
        })

        router.get('/:first', function firstMiddleware(ctx) {
          ctx.throw(400, '☃')
        })

        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            [
              'Nodejs/Middleware/Koa/errorHandler',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ]
          ])
          const errors = agent.errors.eventAggregator
          assert.equal(errors.length, 1, 'error should be recorded')
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first',
            'transaction should be named after the matched layer path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test(
        'should name tx after route declarations with supported http methods',
        (t, end) => {
          const { agent, router, app } = t.nr
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

          const segmentTree = semver.gte(pathToRegexVersion, '8.0.0')
            ? ['Nodejs/Middleware/Koa/terminalMiddleware//:second']
            : [
                'Nodejs/Middleware/Koa/secondMiddleware//:first',
                [
                  'Nodejs/Middleware/Koa/secondMiddleware//:second',
                  ['Nodejs/Middleware/Koa/terminalMiddleware//:second']
                ]
              ]
          app.use(router.routes())
          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET//:second',
              ['Koa/Router: /', segmentTree]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET//:second',
              'transaction should be named after the last matched path'
            )
            end()
          })
          run({ context: t.nr })
        }
      )

      await t.test('names transaction (not found) with array of paths and no handler', (t, end) => {
        const { agent, router, app } = t.nr
        // This will register the same middleware (i.e. secondMiddleware)
        // under both the /:first and /:second routes.
        router.use(['/:first', '/:second'], function secondMiddleware(ctx, next) {
          ctx.body += ' second'
          return next()
        })
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            ['Koa/Router: /']
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
            'transaction should be named (not found)'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test(
        'names tx (not found) when no matching route and base middleware does not set body',
        (t, end) => {
          const { agent, router, app } = t.nr
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
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              ['Nodejs/Middleware/Koa/baseMiddleware', ['Koa/Router: /']]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not found)',
              'transaction should be named (not found)'
            )
            end()
          })
          run({ path: '/', context: t.nr })
        }
      )
    })

    await t.test('using multiple routers', async (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)

      await t.test('should name transaction after last route for identical matches', (t, end) => {
        const { agent, router, app } = t.nr
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
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//:first',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/secondMiddleware//:second']]
              ]
            ]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the most specific matched path'
          )
          end()
        })
        run({ context: t.nr })
      })

      await t.test('should name tx after last matched route even if body not set', (t, end) => {
        const { agent, router, app } = t.nr
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
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            [
              'Koa/Router: /',
              [
                'Nodejs/Middleware/Koa/firstMiddleware//first',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/secondMiddleware//:second']]
              ]
            ]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:second',
            'transaction should be named after the last matched path'
          )
          end()
        })
        run({ path: '/first', context: t.nr })
      })
    })

    await t.test('using nested or prefixed routers', async (t) => {
      t.beforeEach(testSetup)
      t.afterEach(tearDown)

      await t.test('should name after most last matched path', (t, end) => {
        const { agent, router, Router, app } = t.nr
        const router2 = new Router()
        router2.get('/:second', function secondMiddleware(ctx) {
          ctx.body = ' second'
        })
        router.use('/:first', router2.routes())
        app.use(router.routes())
        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            ['Koa/Router: /', [getNestedSpanName('secondMiddleware')]]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            'transaction should be named after the last matched path'
          )
          end()
        })
        run({ path: '/123/456/', context: t.nr })
      })

      await t.test('app-level middleware should not rename tx from matched path', (t, end) => {
        const { agent, router, Router, app } = t.nr
        app.use(function appLevelMiddleware(ctx, next) {
          return next().then(() => {
            ctx.body = 'do not want this to set the name'
          })
        })

        const nestedRouter = new Router()
        nestedRouter.get('/:second', function terminalMiddleware(ctx) {
          ctx.body = 'this is a test'
        })
        router.use('/:first', nestedRouter.routes())
        app.use(router.routes())

        agent.on('transactionFinished', (tx) => {
          assertSegments(tx.trace, tx.trace.root, [
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            [
              'Nodejs/Middleware/Koa/appLevelMiddleware',
              ['Koa/Router: /', [getNestedSpanName('terminalMiddleware')]]
            ]
          ])
          assert.equal(
            tx.name,
            'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
            'should be named after last matched route'
          )
          end()
        })
        run({ path: '/123/second', context: t.nr })
      })

      await t.test(
        'app-level middleware should not rename tx from matched prefix path',
        (t, end) => {
          const { agent, router, app } = t.nr
          app.use(function appLevelMiddleware(ctx, next) {
            return next().then(() => {
              ctx.body = 'do not want this to set the name'
            })
          })

          router.get('/:second', function terminalMiddleware(ctx) {
            ctx.body = 'this is a test'
          })
          router.prefix('/:first')
          app.use(router.routes())

          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
              [
                'Nodejs/Middleware/Koa/appLevelMiddleware',
                ['Koa/Router: /', ['Nodejs/Middleware/Koa/terminalMiddleware//:first/:second']]
              ]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET//:first/:second',
              'should be named after the last matched path'
            )
            end()
          })
          run({ path: '/123/second', context: t.nr })
        }
      )
    })

    await t.test('using allowedMethods', async (t) => {
      // `@koa/router@13.0.0` changed the allowedMethods middleware function from named to arrow function
      // update span name for assertions
      const allowedMethodsFnName = semver.gte(pkgVersion, '13.0.0')
        ? '<anonymous>'
        : 'allowedMethods'

      await t.test('with throw: true', async (t) => {
        t.beforeEach(testSetup)
        t.afterEach(tearDown)

        await t.test(
          'should name transaction after status `method now allowed` message',
          (t, end) => {
            const { agent, router, app } = t.nr
            router.post('/:first', function firstMiddleware() {})
            app.use(router.routes())
            app.use(router.allowedMethods({ throw: true }))
            agent.on('transactionFinished', (tx) => {
              assertSegments(tx.trace, tx.trace.root, [
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
              ])
              assert.equal(
                tx.name,
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                'transaction should be named after corresponding status code message'
              )
              const errors = agent.errors.eventAggregator
              assert.equal(errors.length, 1, 'the error has been recorded')
              end()
            })
            run({ context: t.nr })
          }
        )

        await t.test('should name transaction after status `not implemented` message', (t, end) => {
          const { agent, Router, app } = t.nr
          const router = new Router({ methods: ['POST'] })
          router.post('/:first', function firstMiddleware() {})
          app.silent = true
          app.use(router.routes())
          app.use(router.allowedMethods({ throw: true }))
          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )

            const errors = agent.errors.eventAggregator
            assert.equal(errors.length, 1, 'the error has been recorded')
            end()
          })
          run({ context: t.nr })
        })

        await t.test(
          'error handler normalizes tx name if body is reset without status',
          (t, end) => {
            const { agent, router, Router, app } = t.nr
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
              assertSegments(tx.trace, tx.trace.root, [
                'WebTransaction/NormalizedUri/*',
                [
                  'Nodejs/Middleware/Koa/errorHandler',
                  ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
                ]
              ])
              assert.equal(
                tx.name,
                'WebTransaction/NormalizedUri/*',
                'should have normalized transaction name'
              )
              const errors = agent.errors.eventAggregator
              assert.equal(errors.length, 0, 'error should not be recorded')
              end()
            })
            run({ path: '/123/456', context: t.nr })
          }
        )

        await t.test(
          'should name tx after status message when base middleware does not set body',
          (t, end) => {
            const { agent, router, Router, app } = t.nr
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
              assertSegments(tx.trace, tx.trace.root, [
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                [
                  'Nodejs/Middleware/Koa/baseMiddleware',
                  ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
                ]
              ])
              assert.equal(
                tx.name,
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                'should name after returned status code'
              )
              const errors = agent.errors.eventAggregator
              assert.equal(errors.length, 1, 'should notice thrown error')

              end()
            })
            run({ path: '/123/456', context: t.nr })
          }
        )
      })

      await t.test('with throw: false', async (t) => {
        t.beforeEach(testSetup)
        t.afterEach(tearDown)

        await t.test(
          'should name transaction after status `method now allowed` message',
          (t, end) => {
            const { agent, router, app } = t.nr
            router.post('/:first', function firstMiddleware() {})
            app.use(router.routes())
            app.use(router.allowedMethods())
            agent.on('transactionFinished', (tx) => {
              assertSegments(tx.trace, tx.trace.root, [
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
              ])
              assert.equal(
                tx.name,
                'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
                'transaction should be named after corresponding status code message'
              )
              // Agent will automatically create error for 405 status code.
              const errors = agent.errors.eventAggregator
              assert.equal(errors.length, 1, 'the error has been recorded')
              end()
            })
            run({ context: t.nr })
          }
        )

        await t.test('should name transaction after status `not implemented` message', (t, end) => {
          const { agent, app, Router } = t.nr
          const router = new Router({ methods: ['POST'] })
          router.post('/:first', function firstMiddleware() {})
          app.use(router.routes())
          app.use(router.allowedMethods())
          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )
            // Agent will automatically create error for 501 status code.
            const errors = agent.errors.eventAggregator
            assert.equal(errors.length, 1, 'the error has been recorded')
            end()
          })
          run({ context: t.nr })
        })

        await t.test('should name tx after `method not allowed` with prefixed router', (t, end) => {
          const { agent, router, app } = t.nr
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
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              [
                'Nodejs/Middleware/Koa/appLevelMiddleware',
                ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
              ]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(method not allowed)',
              'transaction should be named after corresponding status code message'
            )
            end()
          })
          run({ path: '/123/second', context: t.nr })
        })

        await t.test('should name tx after `not implemented` with prefixed router', (t, end) => {
          const { agent, app, Router } = t.nr
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
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              [
                'Nodejs/Middleware/Koa/appLevelMiddleware',
                ['Koa/Router: /', [`Nodejs/Middleware/Koa/${allowedMethodsFnName}`]]
              ]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET/(not implemented)',
              'transaction should be named after corresponding status code message'
            )
            end()
          })
          run({ path: '/123/first', context: t.nr })
        })

        await t.test('should name and produce segments for existing matched path', (t, end) => {
          const { agent, app, Router } = t.nr
          const router = new Router({ methods: ['GET'] })
          router.get('/:first', function firstMiddleware(ctx) {
            ctx.body = 'first'
          })
          app.use(router.routes())
          app.use(router.allowedMethods())
          agent.on('transactionFinished', (tx) => {
            assertSegments(tx.trace, tx.trace.root, [
              'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              ['Koa/Router: /', ['Nodejs/Middleware/Koa/firstMiddleware//:first']]
            ])
            assert.equal(
              tx.name,
              'WebTransaction/WebFrameworkUri/Koa/GET//:first',
              'transaction should be named after the matched path'
            )
            end()
          })
          run({ context: t.nr })
        })
      })
    })
  })
}
