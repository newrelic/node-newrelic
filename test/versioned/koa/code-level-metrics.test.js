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
  const Koa = require('koa')
  const app = new Koa()
  const server = await startServer(app)

  ctx.agent = agent
  ctx.app = app
  ctx.server = server
}

test('vanilla koa, no router', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
  })

  t.afterEach((ctx) => {
    ctx.nr.server.close()
    removeModules(['koa'])
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

      agent.on('transactionFinished', (transaction) => {
        const [baseSegment] = transaction.trace.getChildren(transaction.trace.root.id)
        const [one] = transaction.trace.getChildren(baseSegment.id)
        const [two] = transaction.trace.getChildren(one.id)

        assertClmAttrs(
          {
            segments: [
              {
                segment: one,
                name: 'one',
                filepath: 'code-level-metrics.test.js'
              },
              {
                segment: two,
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
