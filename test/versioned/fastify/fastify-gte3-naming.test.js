/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const semver = require('semver')

const { version: pkgVersion } = require('fastify/package')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const runTests = require('./naming-common')

/**
 * Helper to return the list of expected segments
 *
 * @param {Array} uri the request URI
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

async function setupFastifyServer(fastify, calls) {
  common.setupRoutes(fastify)

  if (semver.major(pkgVersion) === 3) {
    await fastify.register(require('middie'))
  } else {
    await fastify.register(require('@fastify/middie'))
  }

  common.registerMiddlewares({ fastify, calls })
}

test('standard export', async (t) => {
  test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    const calls = { test: 0, middleware: 0 }
    const fastify = require('fastify')()
    await setupFastifyServer(fastify, calls)
    ctx.nr.calls = calls
    ctx.nr.fastify = fastify
  })

  test.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.fastify.close()

    removeModules(['fastify', '@fastify/middie', 'middie'])
  })

  await t.test(async (t) => {
    await runTests(t, getExpectedSegments)
  })
})

test('fastify property', async (t) => {
  test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    const calls = { test: 0, middleware: 0 }
    const fastify = require('fastify').fastify()
    await setupFastifyServer(fastify, calls)
    ctx.nr.calls = calls
    ctx.nr.fastify = fastify
  })

  test.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.fastify.close()

    removeModules(['fastify', '@fastify/middie', 'middie'])
  })

  await t.test(async (t) => {
    await runTests(t, getExpectedSegments)
  })
})

test('default property', async (t) => {
  test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
      attributes: {
        enabled: true,
        include: ['request.parameters.*']
      }
    })

    const calls = { test: 0, middleware: 0 }
    const fastify = require('fastify').default()
    await setupFastifyServer(fastify, calls)
    ctx.nr.calls = calls
    ctx.nr.fastify = fastify
  })

  test.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.fastify.close()

    removeModules(['fastify', '@fastify/middie', 'middie'])
  })

  await t.test(async (t) => {
    await runTests(t, getExpectedSegments)
  })
})
