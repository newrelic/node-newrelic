/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const { once } = require('node:events')
const { assertSegments } = require('../../lib/custom-assertions')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  const fastify = require('fastify')()
  common.setupRoutes(fastify)
  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  ctx.nr.fastify = fastify
  ctx.nr.host = address
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.fastify.close()
  removeModules(['fastify', '@fastify/middie'])
})

for (const route of common.routesToTest) {
  test(`should not instrument ${route} in fastify 3.x`, async (t) => {
    const { agent, host } = t.nr
    const [transaction, result] = await Promise.allSettled([
      once(agent, 'transactionFinished'),
      common.makeRequest(host, route)
    ])
    const [tx] = transaction.value

    // if fastify instrumentation was loaded the transaction segment would be
    // named something like `WebFrameworkUri/Fastify/<method>//<route>`
    const expectedSegments = [
      'WebTransaction/NormalizedUri/*'
    ]
    assertSegments(tx.trace, tx.trace.root, expectedSegments)
    assert.deepEqual(result.value, { called: route })
  })
}
