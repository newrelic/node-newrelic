/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const createTests = require('./naming-common')

/**
 * Helper to return the list of expected segments
 *
 * @param {Array} uri
 * @returns {Array} formatted list of expected segments
 */
function getExpectedSegments(uri) {
  return [
    'Nodejs/Middleware/Fastify/onRequest/testMiddleware',
    `Nodejs/Middleware/Fastify/onRequest/pathMountedMiddleware/${uri}`,
    `Nodejs/Middleware/Fastify/<anonymous>/${uri}`
  ]
}

tap.test('Test Transaction Naming', (test) => {
  test.autoend()

  test.beforeEach(() => {
    const agent = helper.instrumentMockedAgent()
    const fastify = require('fastify')()
    const calls = { test: 0, middleware: 0 }
    test.context.agent = agent
    test.context.fastify = fastify
    test.context.calls = calls
    common.setupRoutes(fastify)
    common.registerMiddlewares({ fastify, calls })
  })

  test.afterEach(() => {
    const { fastify, agent } = test.context
    helper.unloadAgent(agent)
    fastify.close()
  })

  createTests(test, getExpectedSegments)
})
