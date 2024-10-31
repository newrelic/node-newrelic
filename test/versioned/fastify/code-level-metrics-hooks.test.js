/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertCLMAttrs } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const common = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = { agent: null, fastify: null }
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }

  if (ctx.nr.fastify) {
    ctx.nr.fastify.close()
  }

  removeModules(['fastify'])
})

async function performTest(t) {
  const { agent, fastify } = t.nr
  fastify.addHook('onRequest', function testOnRequest(...args) {
    const next = args.pop()
    next()
  })

  fastify.addHook('onSend', function testOnSend(...args) {
    const next = args.pop()
    next()
  })

  let txPassed = false
  agent.on('transactionFinished', (transaction) => {
    const [baseSegment] = transaction.trace.getChildren(transaction.trace.root.id)
    let [onRequestSegment, handlerSegment] = transaction.trace.getChildren(baseSegment.id)
    if (helper.isSecurityAgentEnabled(agent)) {
      ;[onRequestSegment, handlerSegment] = transaction.trace.getChildren(onRequestSegment.id)
    }
    const [onSendSegment] = transaction.trace.getChildren(handlerSegment.id)
    assertCLMAttrs({
      segments: [
        {
          segment: onRequestSegment,
          name: 'testOnRequest',
          filepath: 'test/versioned/fastify/code-level-metrics-hooks.test.js'
        },
        {
          segment: onSendSegment,
          name: 'testOnSend',
          filepath: 'test/versioned/fastify/code-level-metrics-hooks.test.js'
        },
        {
          segment: handlerSegment,
          name: 'routeHandler',
          filepath: 'test/versioned/fastify/common.js'
        }
      ],
      enabled: agent.config.code_level_metrics.enabled
    })

    txPassed = true
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const result = await common.makeRequest(address, '/add-hook')

  assert.deepEqual(result, { hello: 'world' })

  assert.equal(txPassed, true, 'transactionFinished assertions passed')
}

test('should add attributes', async (t) => {
  t.nr.agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: true } })
  t.nr.fastify = require('fastify')()
  common.setupRoutes(t.nr.fastify)
  await performTest(t)
})

test('should not add attributes', async (t) => {
  t.nr.agent = helper.instrumentMockedAgent({ code_level_metrics: { enabled: false } })
  t.nr.fastify = require('fastify')()
  common.setupRoutes(t.nr.fastify)
  await performTest(t)
})
