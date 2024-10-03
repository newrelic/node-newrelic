/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const runTests = require('./naming-common')

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

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const calls = { test: 0, middleware: 0 }
  const fastify = require('fastify')()
  common.setupRoutes(fastify)
  common.registerMiddlewares({ fastify, calls })
  ctx.nr.calls = calls
  ctx.nr.fastify = fastify
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.fastify.close()

  removeModules(['fastify'])
})

test('fastify@2 transaction naming', async (t) => {
  await runTests(t, getExpectedSegments)
})
