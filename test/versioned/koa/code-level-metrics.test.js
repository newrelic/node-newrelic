/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const http = require('node:http')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const assertClmAttrs = require('../../lib/custom-assertions/assert-clm-attrs')

async function setupApp({ ctx, useKoaRouter, useAtKoaRouter, isCLMEnabled }) {
  const agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: isCLMEnabled } })
  let router

  if (useKoaRouter === true) {
    const Router = require('koa-router')
    router = new Router()
  }

  if (useAtKoaRouter === true) {
    const Router = require('@koa/router')
    router = new Router()
  }

  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  ctx.agent = agent
  ctx.app = app
  ctx.router = router
  ctx.server = server
}

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
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

test('vanilla koa, no router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa', '@koa/router', 'koa-router'])
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const isCLMEnabled of [true, false]) {
    await t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      const plan = tspl(t, { plan: 9 })

      await setupApp({ ctx: t.nr, isCLMEnabled })
      const { agent, app, server } = t.nr

      app.use(function one(_, next) {
        next()
      })
      app.use(function two(ctx) {
        ctx.body = 'done'
      })

      agent.on('transactionFinished', (tx) => {
        const baseSegment = tx.trace.root.children[0]
        assertClmAttrs(
          {
            segments: [
              {
                segment: baseSegment.children[0],
                name: 'one',
                filepath: 'code-level-metrics.test.js'
              },
              {
                segment: baseSegment.children[0].children[0],
                name: 'two',
                filepath: 'code-level-metrics.test.js'
              }
            ],
            enabled: isCLMEnabled
          },
          { assert: plan }
        )
      })

      const response = await makeRequest({ port: server.address().port })
      plan.equal(response, 'done', 'should return the correct data')

      await plan.completed
    })
  }
})

test('using koa-router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa', '@koa/router', 'koa-router'])
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const isCLMEnabled of [true, false]) {
    await t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      const plan = tspl(t, { plan: 13 })

      await setupApp({ ctx: t.nr, isCLMEnabled, useKoaRouter: true })
      const { agent, app, router, server } = t.nr

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

      agent.on('transactionFinished', (tx) => {
        const baseSegment = tx.trace.root.children[0]
        assertClmAttrs(
          {
            segments: [
              {
                segment: baseSegment.children[0],
                name: 'dispatch',
                filepath: 'koa-router/lib/router.js'
              },
              {
                segment: baseSegment.children[0].children[0],
                name: 'appLevelMiddleware',
                filepath: 'code-level-metrics.test.js'
              },
              {
                segment: baseSegment.children[0].children[0].children[0],
                name: 'secondMiddleware',
                filepath: 'code-level-metrics.test.js'
              }
            ],
            enabled: isCLMEnabled
          },
          { assert: plan }
        )
      })

      const response = await makeRequest({ port: server.address().port, path: '/123/second' })
      plan.equal(response, 'winner winner, chicken dinner', 'should return the correct data')

      await plan.completed
    })
  }
})

test('using @koa/router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa', '@koa/router', 'koa-router'])
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const isCLMEnabled of [true, false]) {
    await t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      const plan = tspl(t, { plan: 13 })

      await setupApp({ ctx: t.nr, isCLMEnabled, useAtKoaRouter: true })
      const { agent, app, router, server } = t.nr

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

      agent.on('transactionFinished', (tx) => {
        const baseSegment = tx.trace.root.children[0]
        assertClmAttrs(
          {
            segments: [
              {
                segment: baseSegment.children[0],
                name: 'dispatch',
                filepath: '@koa/router/lib/router.js'
              },
              {
                segment: baseSegment.children[0].children[0],
                name: 'appLevelMiddleware',
                filepath: 'code-level-metrics.test.js'
              },
              {
                segment: baseSegment.children[0].children[0].children[0],
                name: 'secondMiddleware',
                filepath: 'code-level-metrics.test.js'
              }
            ],
            enabled: isCLMEnabled
          },
          { assert: plan }
        )
      })

      const response = await makeRequest({ port: server.address().port, path: '/123/second' })
      plan.equal(response, 'winner winner, chicken dinner', 'should return the correct data')

      await plan.completed
    })
  }
})
