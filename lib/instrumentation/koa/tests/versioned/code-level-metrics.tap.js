/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const http = require('http')

// This adds all the assertions to tap's `Test` class.
utils.assert.extendTap(tap)

async function setupApp({ useKoaRoute, useKoaRouter, useAtKoaRouter }) {
  const helper = utils.TestAgent.makeInstrumented({ code_level_metrics: { enabled: true } })
  let router

  helper.registerInstrumentation({
    moduleName: 'koa',
    type: 'web-framework',
    onRequire: require('../../lib/instrumentation')
  })

  if (useKoaRoute) {
    helper.registerInstrumentation({
      moduleName: 'koa-route',
      type: 'web-framework',
      onRequire: require('../../lib/route-instrumentation')
    })
    router = require('koa-route')
  }

  if (useKoaRouter) {
    helper.registerInstrumentation({
      moduleName: 'koa-router',
      type: 'web-framework',
      onRequire: require('../../lib/router-instrumentation')
    })

    const Router = require('koa-router')
    router = new Router()
  }

  if (useAtKoaRouter) {
    helper.registerInstrumentation({
      moduleName: '@koa/router',
      type: 'web-framework',
      onRequire: require('../../lib/router-instrumentation')
    })
    const Router = require('@koa/router')
    router = new Router()
  }

  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  return { helper, app, router, server }
}

async function makeRequest(params) {
  return new Promise((resolve, reject) => {
    const req = http.request(params, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Status Code: ${res.statusCode}`))
        return
      }

      const data = []

      res.on('data', (chunk) => {
        data.push(chunk)
      })

      res.on('end', () => resolve(Buffer.concat(data).toString()))
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

async function teardownApp(server, helper) {
  return new Promise((resolve) => {
    if (helper) {
      helper.unload()
    }

    if (server) {
      server.close(resolve)
    } else {
      resolve()
    }
  })
}

tap.test('Vanilla koa, no router', (t) => {
  t.autoend()

  let helper
  let app
  let server

  t.before(async () => {
    ;({ helper, app, server } = await setupApp({
      useKoaRoute: false,
      useKoaRouter: false,
      useAtKoaRouter: false
    }))
  })

  t.afterEach(async () => {
    await teardownApp(server, helper)
  })

  t.test('should add CLM attributes', async (t) => {
    app.use(function one(_, next) {
      next()
    })

    app.use(function two(ctx) {
      ctx.body = 'done'
    })

    helper.agent.on('transactionFinished', (transaction) => {
      const baseSegment = transaction.trace.root.children[0]
      t.clmAttrs({
        segments: [
          {
            segment: baseSegment.children[0],
            name: 'one',
            filepath: 'code-level-metrics.tap.js'
          },
          {
            segment: baseSegment.children[0].children[0],
            name: 'two',
            filepath: 'code-level-metrics.tap.js'
          }
        ],
        enabled: true,
        test: t
      })
    })

    const response = await makeRequest({ port: server.address().port })

    t.equal(response, 'done', 'should return the correct data')
  })
})

tap.test('Using koa-route', (t) => {
  t.autoend()

  let helper
  let app
  let server
  let router

  t.before(async () => {
    ;({ helper, app, server, router } = await setupApp({
      useKoaRoute: true,
      useKoaRouter: false,
      useAtKoaRouter: false
    }))
  })

  t.afterEach(async () => {
    await teardownApp(server, helper)
  })

  t.test('should add CLM attributes', async (t) => {
    const first = router.get('/:first', function firstMiddleware(ctx, param, next) {
      return next().then(function respond() {
        ctx.body = 'first'
      })
    })
    const second = router.get('/:second', function secondMiddleware(ctx) {
      ctx.body = 'second'
    })

    app.use(first)
    app.use(second)

    helper.agent.on('transactionFinished', (transaction) => {
      const baseSegment = transaction.trace.root.children[0]
      console.log(baseSegment.children[0].name, baseSegment.children[0].getAttributes())
      console.log(
        baseSegment.children[0].children[0].name,
        baseSegment.children[0].children[0].getAttributes()
      )
    })

    const response = await makeRequest({ port: server.address().port, path: '/foo' })

    t.equal(response, 'first', 'should return the correct data')
  })
})

tap.test('Using koa-router', (t) => {
  t.autoend()

  let helper
  let app
  let server
  let router

  t.before(async () => {
    ;({ helper, app, server, router } = await setupApp({
      useKoaRoute: false,
      useKoaRouter: true,
      useAtKoaRouter: false
    }))
  })

  t.afterEach(async () => {
    await teardownApp(server, helper)
  })

  t.test('should add CLM attributes', async (t) => {
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

    function appLevelMiddleware(ctx, next) {
      ctx.body += ' second'
      return next()
    }

    app.use(router.routes())
    app.use(appLevelMiddleware)

    helper.agent.on('transactionFinished', (/* transaction */) => {
      t.ok(true)
    })

    const response = await makeRequest({ port: server.address().port, path: '/bar' })
    t.equal(response, 'first', 'should return the correct data')
  })
})

tap.test('Using @koa/router', (t) => {
  t.autoend()

  let helper
  let app
  let server
  let router

  t.before(async () => {
    ;({ helper, app, server, router } = await setupApp({
      useKoaRoute: false,
      useKoaRouter: false,
      useAtKoaRouter: true
    }))
  })

  t.afterEach(async () => {
    await teardownApp(server, helper)
  })

  t.test('should add CLM attributes', async (t) => {
    app.use(function appLevelMiddleware(ctx, next) {
      return next().then(() => {
        ctx.body = 'do not want this to set the name'
      })
    })

    const Router = require('@koa/router')
    const nestedRouter = new Router()
    nestedRouter.get('/:second', function terminalMiddleware(ctx) {
      ctx.body = 'this is a test'
    })
    nestedRouter.get('/second', function secondMiddleware(ctx) {
      ctx.body = 'want this to set the name'
    })

    router.use('/:first', nestedRouter.routes())
    app.use(router.routes())

    helper.agent.on('transactionFinished', (/* transaction */) => {
      t.ok(true)
    })

    const response = await makeRequest({ port: server.address().port, path: '/123/second' })
    t.equal(response, 'do not want this to set the name', 'should return the correct data')
  })
})
