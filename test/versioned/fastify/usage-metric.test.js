/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')

test('only records one usage metric', async (t) => {
  t.plan(4)

  const agent = helper.instrumentMockedAgent()
  const fastify = require('fastify')
  const pkg = require('fastify/package.json')
  const version = Number(pkg.version.split('.', 1))
  const keyBase = 'Supportability/Features/Instrumentation/SubscriberUsed/fastify'
  const server = fastify({ logger: false })

  t.after(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  server.decorate('test', {
    getter() {
      return this._test
    },
    setter(value) {
      this._test = value
    }
  })

  server.addHook('preHandler', function(req, res, done) {
    this.test = true
    done()
  })

  server.route({
    path: '/',
    method: 'get',
    handler (req, res) {
      t.assert.equal(this.test, true)
      res.send('ok')
    }
  })

  const address = await server.listen({ port: 0 })

  agent.on('transactionFinished', () => {
    const metrics = agent.metrics._metrics.unscoped
    t.assert.equal(metrics[keyBase].callCount, 1)
    t.assert.equal(metrics[`${keyBase}/${version}`].callCount, 1)
  })

  const { body } = await helper.asyncHttpCall(address)
  t.assert.equal(body, 'ok')
})
