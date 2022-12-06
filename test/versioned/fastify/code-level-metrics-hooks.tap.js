/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')

tap.Test.prototype.addAssert('clmAttrs', 1, helper.assertCLMAttrs)

function setupFastifyServer(fastify) {
  common.setupRoutes(fastify)
}

function setup(test, config) {
  const agent = helper.instrumentMockedAgent(config)
  const fastify = require('fastify')()

  setupFastifyServer(fastify)

  test.context.agent = agent
  test.context.fastify = fastify

  test.teardown(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })
}

tap.test('Fastify CLM Hook Based', (test) => {
  test.autoend()
  ;[true, false].forEach((isCLMEnabled) => {
    test.test(isCLMEnabled ? 'should add attributes' : 'should not add attributes', async (t) => {
      setup(t, { code_level_metrics: { enabled: isCLMEnabled } })
      const { agent, fastify } = t.context

      fastify.addHook('onRequest', function testOnRequest(...args) {
        const next = args.pop()
        next()
      })

      fastify.addHook('onSend', function testOnSend(...args) {
        const next = args.pop()
        next()
      })

      agent.on('transactionFinished', (transaction) => {
        const baseSegment = transaction.trace.root.children
        const [onRequestSegment, handlerSegment] = baseSegment[0].children
        const onSendSegment = transaction.trace.root.children[0].children[1].children[0]
        t.clmAttrs({
          segments: [
            {
              segment: onRequestSegment,
              name: 'testOnRequest',
              filepath: 'test/versioned/fastify/code-level-metrics-hooks.tap.js'
            },
            {
              segment: onSendSegment,
              name: 'testOnSend',
              filepath: 'test/versioned/fastify/code-level-metrics-hooks.tap.js'
            },
            {
              segment: handlerSegment,
              name: 'routeHandler',
              filepath: 'test/versioned/fastify/common.js'
            }
          ],
          enabled: isCLMEnabled
        })
      })

      await fastify.listen(0)
      const address = fastify.server.address()
      const result = await common.makeRequest(address, '/add-hook')

      t.same(result, { hello: 'world' })
    })
  })
})
