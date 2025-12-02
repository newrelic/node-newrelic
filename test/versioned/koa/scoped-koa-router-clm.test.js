/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')
const semver = require('semver')
const { startServer, makeRequest } = require('./utils')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const assertClmAttrs = require('../../lib/custom-assertions/assert-clm-attrs')

async function setupApp({ ctx, isCLMEnabled }) {
  const agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: isCLMEnabled } })

  const routerPkg = require('@koa/router')
  const Router = routerPkg.Router || routerPkg
  const router = new Router()
  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  ctx.agent = agent
  ctx.app = app
  ctx.router = router
  ctx.server = server
}

test('using @koa/router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa', '@koa/router'])
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const isCLMEnabled of [true, false]) {
    await t.test(`should ${isCLMEnabled ? 'add' : 'not add'} CLM attributes`, async (t) => {
      await setupApp({ ctx: t.nr, isCLMEnabled, useAtKoaRouter: true })
      const { agent, app, router, server } = t.nr

      const routerPkg = require('@koa/router')
      const pkgVersion = helper.readPackageVersion(__dirname, '@koa/router')
      const testPlan = semver.lt(pkgVersion, '15.0.0') ? 13 : 9
      const plan = tspl(t, { plan: testPlan })
      const Router = routerPkg.Router || routerPkg
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
        const segments = [
          {
            segment: appLevel,
            name: 'appLevelMiddleware',
            filepath: 'scoped-koa-router-clm.test.js'
          },
          {
            segment: secondMw,
            name: 'secondMiddleware',
            filepath: 'scoped-koa-router-clm.test.js'
          }
        ]

        // In 15.0.0+ the `dispatch` method is bound and we can no longer obtain
        // function information
        // See: https://github.com/koajs/router/blob/b65d6aee875cc0065082d4a95cc54856cc57c37e/src/router.ts#L411
        if (semver.lt(pkgVersion, '15.0.0')) {
          segments.unshift({
            segment: dispatch,
            name: 'dispatch',
            filepath: '@koa/router/lib/router.js'
          })
        }

        assertClmAttrs({ segments, enabled: isCLMEnabled }, { assert: plan })
      })

      const response = await makeRequest({ port: server.address().port, path: '/123/second' })
      plan.equal(response, 'winner winner, chicken dinner', 'should return the correct data')

      await plan.completed
    })
  }
})
