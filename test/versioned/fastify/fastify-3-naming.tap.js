/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const requestClient = require('request')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')

let callCount = 0
const loadMiddleware = async (fastify) => {
  function testMiddleware(req, res, next) {
    callCount++
    next()
  }

  await fastify.register(require('middie'))

  fastify.use(testMiddleware)
}

/**
 * Single function to register all the routes used by the test
 *
 * @todo Would this be better closer to test, or is it good here
 */
const configureFastifyServer = async (fastify) => {
  /**
   * Route's callback is an async function, and response is returned
   */
  fastify.get('/async-return', async () => {
    return { called: '/async-return' }
  })

  /**
   * Route's callback is an async function, and response is sent via reply
   */
  fastify.get('/async-reply-send', async (request, reply) => {
    reply.send({ called: '/async-reply-send' })
  })

  /**
   * Route's callback is not an async function, and response is sent via reply
   */
  fastify.get('/sync-reply-send', (request, reply) => {
    reply.send({ called: '/sync-reply-send' })
  })

  /**
   * Register a route via plugin to make sure our wrapper catches these
   */
  fastify.register(function (fastifyInstance, options, done) {
    fastifyInstance.get('/plugin-registered', async () => {
      return { called: '/plugin-registered' }
    })
    done()
  }, {})

  await loadMiddleware(fastify)
}

let testCount = 0
const testUri = (uri, agent, test, port) => {
  agent.on('transactionFinished', (transaction) => {
    testCount++
    test.equal(
      `WebFrameworkUri/Fastify/GET/${uri}`,
      transaction.getName(),
      `transaction name matched for ${uri}`
    )
    metrics.assertSegments(transaction.trace.root, [
      `WebTransaction/WebFrameworkUri/Fastify/GET/${uri}`,
      [`Nodejs/Middleware/Fastify/<anonymous>/${uri}`]
    ])
  })

  requestClient.get(`http://127.0.0.1:${port}${uri}`, function (error, response, body) {
    const result = (body = JSON.parse(body))
    test.equal(result.called, uri, `${uri} url did not error`)
  })
}

const routesToTest = [
  '/async-return',
  '/async-reply-send',
  '/sync-reply-send',
  '/plugin-registered'
]

tap.test('Test Transaction Naming - Standard Export', (test) => {
  test.autoend()

  test.beforeEach(async (t) => {
    const agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    const fastify = require('fastify')()
    await configureFastifyServer(fastify)

    t.context.agent = agent
    t.context.fastify = fastify
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test)
})

tap.test('Test Transaction Naming - Fastify Property', (test) => {
  test.autoend()

  test.beforeEach(async (t) => {
    const agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    const fastify = require('fastify').fastify()
    await configureFastifyServer(fastify)

    t.context.agent = agent
    t.context.fastify = fastify
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test)
})

tap.test('Test Transaction Naming - Default Property', (test) => {
  test.autoend()

  test.beforeEach(async (t) => {
    const agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    const fastify = require('fastify').default()
    const { version: pkgVersion } = require('fastify/package')
    await configureFastifyServer(fastify, pkgVersion)

    t.context.agent = agent
    t.context.fastify = fastify
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test)
})

function createTests(t) {
  for (const [, uri] of routesToTest.entries()) {
    t.test(`testing naming for ${uri} `, (t) => {
      const { agent, fastify } = t.context

      t.autoend()
      t.plan(2)
      fastify.listen(0).then(() => {
        testUri(uri, agent, t, fastify.server.address().port)
      })
    })
  }

  t.equals(testCount, callCount, 'middleware was called')
}
