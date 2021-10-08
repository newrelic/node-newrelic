/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const createTests = require('./naming-common')

async function setupFastifyServer(fastify, calls) {
  common.setupRoutes(fastify)
  await fastify.register(require('middie'))
  common.registerMiddlewares({ fastify, calls })
}

/**
 * Helper to return the list of expected segments
 *
 * @param {Array} uri
 * @returns {Array} formatted list of expected segments
 */
function getExpectedSegments(uri) {
  return [
    'Nodejs/Middleware/Fastify/onRequest/runMiddie',
    [
      'Nodejs/Middleware/Fastify/onRequest/testMiddleware',
      `Nodejs/Middleware/Fastify/onRequest/pathMountedMiddleware/${uri}`
    ],
    `Nodejs/Middleware/Fastify/<anonymous>/${uri}`
  ]
}

tap.test('Test Transaction Naming - Standard Export', (test) => {
  test.autoend()

  test.beforeEach(async (t) => {
    const agent = helper.instrumentMockedAgent()
    const fastify = require('fastify')()
    const calls = { test: 0, middleware: 0 }
    await setupFastifyServer(fastify, calls)

    t.context.agent = agent
    t.context.fastify = fastify
    t.context.calls = calls
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test, getExpectedSegments)
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
    const calls = { test: 0, middleware: 0 }
    await setupFastifyServer(fastify, calls)

    t.context.agent = agent
    t.context.fastify = fastify
    t.context.calls = calls
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test, getExpectedSegments)
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
    const calls = { test: 0, middleware: 0 }
    await setupFastifyServer(fastify, calls)

    t.context.agent = agent
    t.context.fastify = fastify
    t.context.calls = calls
  })

  test.afterEach((t) => {
    const { agent, fastify } = t.context

    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test, getExpectedSegments)
})
