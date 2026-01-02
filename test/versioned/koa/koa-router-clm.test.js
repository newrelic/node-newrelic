/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')
const { startServer, makeRequest } = require('./utils')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const assertClmAttrs = require('../../lib/custom-assertions/assert-clm-attrs')

async function setupApp({ ctx, isCLMEnabled }) {
  const agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: isCLMEnabled } })

  const Router = require('koa-router')
  const router = new Router()
  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  ctx.agent = agent
  ctx.app = app
  ctx.router = router
  ctx.server = server
}

test('using koa-router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa', 'koa-router'])
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

      agent.on('transactionFinished', (transaction) => {
        const [baseSegment] = transaction.trace.getChildren(transaction.trace.root.id)
        const [dispatch] = transaction.trace.getChildren(baseSegment.id)
        const [appLevel] = transaction.trace.getChildren(dispatch.id)
        const [secondMw] = transaction.trace.getChildren(appLevel.id)

        assertClmAttrs(
          {
            segments: [
              {
                segment: dispatch,
                name: 'dispatch',
                filepath: 'koa-router/lib/router.js'
              },
              {
                segment: appLevel,
                name: 'appLevelMiddleware',
                filepath: 'koa-router-clm.test.js'
              },
              {
                segment: secondMw,
                name: 'secondMiddleware',
                filepath: 'koa-router-clm.test.js'
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
