/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const http = require('http')
let koaRouterAvailable
let atKoaRouterAvailable

try {
  require('./node_modules/koa-router/package.json')
  koaRouterAvailable = true
} catch (err) {
  koaRouterAvailable = false
}

try {
  require('./node_modules/@koa/router/package.json')
  atKoaRouterAvailable = true
} catch (err) {
  atKoaRouterAvailable = false
}

async function setupApp({ useKoaRouter, useAtKoaRouter, isCLMEnabled }) {
  const agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: isCLMEnabled } })
  let router

  if (useKoaRouter) {
    const Router = require('koa-router')
    router = new Router()
  }

  if (useAtKoaRouter) {
    const Router = require('@koa/router')
    router = new Router()
  }

  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  return { agent, app, router, server }
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

async function teardownApp(server, agent) {
  return new Promise((resolve) => {
    if (agent) {
      helper.unloadAgent(agent)
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

  let agent
  let app
  let server
  ;[true, false].forEach((isCLMEnabled) => {
    t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      ;({ agent, app, server } = await setupApp({ isCLMEnabled }))

      app.use(function one(_, next) {
        next()
      })

      app.use(function two(ctx) {
        ctx.body = 'done'
      })

      agent.on('transactionFinished', (transaction) => {
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
          enabled: isCLMEnabled,
          test: t
        })
      })

      const response = await makeRequest({ port: server.address().port })

      t.equal(response, 'done', 'should return the correct data')

      t.teardown(async () => {
        await teardownApp(server, agent)
      })
    })
  })
})

tap.test('Using koa-router', { skip: !koaRouterAvailable }, (t) => {
  t.autoend()

  let agent
  let app
  let server
  let router
  ;[true, false].forEach((isCLMEnabled) => {
    t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      ;({ agent, app, server, router } = await setupApp({ isCLMEnabled, useKoaRouter: true }))

      const Router = require('koa-router')
      const nestedRouter = new Router()

      nestedRouter.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'winner winner, chicken dinner'
      })

      router.use(function appLevelMiddleware(ctx, next) {
        ctx.body = 'nope, not here'
        return next()
      })
      router.use('/:first', nestedRouter.routes())
      app.use(router.routes())

      agent.on('transactionFinished', (transaction) => {
        const baseSegment = transaction.trace.root.children[0]

        t.clmAttrs({
          segments: [
            {
              segment: baseSegment.children[0],
              name: 'dispatch',
              filepath: 'koa-router/lib/router.js'
            },
            {
              segment: baseSegment.children[0].children[0],
              name: 'appLevelMiddleware',
              filepath: 'code-level-metrics.tap.js'
            },
            {
              segment: baseSegment.children[0].children[0].children[0],
              name: 'secondMiddleware',
              filepath: 'code-level-metrics.tap.js'
            }
          ],
          enabled: isCLMEnabled,
          test: t
        })
      })

      const response = await makeRequest({ port: server.address().port, path: '/123/second' })
      t.equal(response, 'winner winner, chicken dinner', 'should return the correct data')
      t.teardown(async () => {
        await teardownApp(server, agent)
      })
    })
  })
})

tap.test('Using @koa/router', { skip: !atKoaRouterAvailable }, (t) => {
  t.autoend()

  let agent
  let app
  let server
  let router
  ;[true, false].forEach((isCLMEnabled) => {
    t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      ;({ agent, app, server, router } = await setupApp({ isCLMEnabled, useAtKoaRouter: true }))

      const Router = require('@koa/router')
      const nestedRouter = new Router()

      nestedRouter.get('/second', function secondMiddleware(ctx) {
        ctx.body = 'winner winner, chicken dinner'
      })

      router.use(function appLevelMiddleware(ctx, next) {
        ctx.body = 'nope, not here'
        return next()
      })
      router.use('/:first', nestedRouter.routes())
      app.use(router.routes())

      agent.on('transactionFinished', (transaction) => {
        const baseSegment = transaction.trace.root.children[0]

        t.clmAttrs({
          segments: [
            {
              segment: baseSegment.children[0],
              name: 'dispatch',
              filepath: '@koa/router/lib/router.js'
            },
            {
              segment: baseSegment.children[0].children[0],
              name: 'appLevelMiddleware',
              filepath: 'code-level-metrics.tap.js'
            },
            {
              segment: baseSegment.children[0].children[0].children[0],
              name: 'secondMiddleware',
              filepath: 'code-level-metrics.tap.js'
            }
          ],
          enabled: isCLMEnabled,
          test: t
        })
      })

      const response = await makeRequest({ port: server.address().port, path: '/123/second' })
      t.equal(response, 'winner winner, chicken dinner', 'should return the correct data')

      t.teardown(async () => {
        await teardownApp(server, agent)
      })
    })
  })
})
