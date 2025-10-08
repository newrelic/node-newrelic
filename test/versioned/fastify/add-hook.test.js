/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, assertSegments } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const common = require('./common')

// all of these events fire before the route handler
// See: https://www.fastify.io/docs/latest/Lifecycle/
// for more info on sequence
const REQUEST_HOOKS = ['onRequest', 'preParsing', 'preValidation', 'preHandler']

// these events fire after the route
// handler. they are in separate arrays
// for segment relationship assertions later
const AFTER_HANDLER_HOOKS = ['preSerialization', 'onSend']

// the onResponse hook fires after a response
// is received by client which is out of context
// of the transaction
const AFTER_TX_HOOKS = ['onResponse']

const ALL_HOOKS = [...REQUEST_HOOKS, ...AFTER_HANDLER_HOOKS, ...AFTER_TX_HOOKS]

/**
 * Helper to return the list of expected segments
 *
 * @param {Array} hooks lifecyle hook names to build segment names from
 * @returns {Array} formatted list of expected segments
 */
function getExpectedSegments(hooks) {
  return hooks.map((hookName) => `Nodejs/Middleware/Fastify/${hookName}/testHook`)
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const fastify = require('fastify')()
  require('undici')
  common.setupRoutes(fastify)
  ctx.nr.fastify = fastify
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.fastify.close()
  removeModules(['fastify'])
})

test('should load tracking metrics', (t) => {
  const { agent } = t.nr
  const { version } = require('fastify/package.json')
  assertPackageMetrics({ agent, pkg: 'fastify', version })
})

test('non-error hooks', async (t) => {
  const { fastify, agent } = t.nr

  // setup hooks
  const ok = ALL_HOOKS.reduce((all, hookName) => {
    all[hookName] = false
    return all
  }, {})

  ALL_HOOKS.forEach((hookName) => {
    fastify.addHook(hookName, function testHook(...args) {
      // lifecycle signatures vary between the events
      // the last arg is always the next function though
      const next = args[args.length - 1]
      ok[hookName] = true
      next()
    })
  })

  let txPassed = false
  agent.on('transactionFinished', (transaction) => {
    assert.equal(
      transaction.getName(),
      'WebFrameworkUri/Fastify/GET//add-hook'
    )
    // all the hooks are siblings of the route handler
    // except the AFTER_HANDLER_HOOKS which are children of the route handler
    let expectedSegments
    if (helper.isSecurityAgentEnabled(agent)) {
      expectedSegments = [
        'WebTransaction/WebFrameworkUri/Fastify/GET//add-hook',
        [
          'Nodejs/Middleware/Fastify/onRequest/<anonymous>',
          [
            ...getExpectedSegments(REQUEST_HOOKS),
            'Nodejs/Middleware/Fastify/routeHandler//add-hook',
            getExpectedSegments(AFTER_HANDLER_HOOKS)
          ]
        ]
      ]
    } else {
      expectedSegments = [
        'WebTransaction/WebFrameworkUri/Fastify/GET//add-hook',
        [
          ...getExpectedSegments(REQUEST_HOOKS),
          'Nodejs/Middleware/Fastify/routeHandler//add-hook',
          getExpectedSegments(AFTER_HANDLER_HOOKS)
        ]
      ]
    }

    assertSegments(transaction.trace, transaction.trace.root, expectedSegments)
    txPassed = true
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const result = await common.makeRequest(address, '/add-hook')
  assert.deepEqual(result, { hello: 'world' })

  // verify every hook was called after response
  for (const [hookName, isOk] of Object.entries(ok)) {
    assert.equal(isOk, true, `${hookName} captured`)
  }

  assert.equal(txPassed, true, 'transactionFinished assertions passed')
})

test('error hook', async function errorHookTest(t) {
  const { fastify, agent } = t.nr

  const hookName = 'onError'
  let ok = false

  fastify.addHook(hookName, function testHook(req, reply, err, next) {
    assert.equal(err.message, 'test onError hook', 'error message correct')
    ok = true
    next()
  })

  let txPassed = false
  agent.on('transactionFinished', (transaction) => {
    assert.equal(
      transaction.getName(),
      'WebFrameworkUri/Fastify/GET//error'
    )
    // all the hooks are siblings of the route handler
    let expectedSegments
    if (helper.isSecurityAgentEnabled(agent)) {
      expectedSegments = [
        'WebTransaction/WebFrameworkUri/Fastify/GET//error',
        [
          'Nodejs/Middleware/Fastify/onRequest/<anonymous>',
          [
            'Nodejs/Middleware/Fastify/errorRoute//error',
            `Nodejs/Middleware/Fastify/${hookName}/testHook`
          ]
        ]
      ]
    } else {
      expectedSegments = [
        'WebTransaction/WebFrameworkUri/Fastify/GET//error',
        [
          'Nodejs/Middleware/Fastify/errorRoute//error',
          `Nodejs/Middleware/Fastify/${hookName}/testHook`
        ]
      ]
    }

    assertSegments(transaction.trace, transaction.trace.root, expectedSegments)

    txPassed = true
  })

  await fastify.listen({ port: 0 })
  const address = fastify.server.address()
  const result = await common.makeRequest(address, '/error')
  assert.ok(ok)
  assert.deepEqual(result, {
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'test onError hook'
  })

  assert.equal(txPassed, true, 'transactionFinished assertions passed')
})
