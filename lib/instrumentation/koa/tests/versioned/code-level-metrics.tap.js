/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const http = require('http')

async function setupApp({ useKoaRoute, useKoaRouter, useAtKoaRouter }) {
  const helper = utils.TestAgent.makeInstrumented()
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

    helper.agent.on('transactionFinished', (/* transaction */) => {
      t.ok(true)
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
    const first = router.get(
      '/:firstMiddleware',
      function firstMiddleware(_ctx, _routeParam, next) {
        return next()
      }
    )
    const second = router.get('/:greetingHandler', function secondMiddleware(ctx, greeting, next) {
      ctx.body = `hello ${greeting}`
      return next()
    })
    const third = function thirdMiddleware(_, next) {
      return next()
    }

    app.use(first)
    app.use(second)
    app.use(third)

    helper.agent.on('transactionFinished', (/* transaction */) => {
      t.ok(true)
    })

    const response = await makeRequest({ port: server.address().port, path: '/foo' })

    t.equal(response, 'hello foo', 'should return the correct data')
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
