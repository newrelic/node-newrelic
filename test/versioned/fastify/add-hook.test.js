/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')
const common = require('./common')
const traceToSegmentTree = require('../../lib/trace-to-segment-tree')

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

const nonErrorHooksSegmentsSnap = require('./snapshots/non-error-hooks-segments.json')
const nonErrorHooksSegmentsSecAgentSnap = require('./snapshots/non-error-hooks-segments-secagent.json')
const errorHooksSegmentsSnap = require('./snapshots/error-hooks-segments.json')
const errorHooksSegmentsSegAgentSnap = require('./snapshots/error-hooks-segments-secagent.json')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const fastify = require('fastify')()
  common.setupRoutes(fastify)
  ctx.nr.fastify = fastify
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.fastify.close()
  removeModules(['fastify'])
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
      'WebFrameworkUri/Fastify/GET//add-hook',
      transaction.getName(),
      'transaction name matched'
    )

    const expectedSegments = helper.isSecurityAgentEnabled(agent)
      ? nonErrorHooksSegmentsSecAgentSnap
      : nonErrorHooksSegmentsSnap
    const actualSegments = traceToSegmentTree(transaction.trace.toJSON())
    assert.deepStrictEqual(actualSegments, expectedSegments)

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
      'WebFrameworkUri/Fastify/GET//error',
      transaction.getName(),
      'transaction name matched'
    )
    // all the hooks are siblings of the route handler
    const expectedSegments = helper.isSecurityAgentEnabled(agent)
      ? errorHooksSegmentsSegAgentSnap
      : errorHooksSegmentsSnap
    const foundSegments = traceToSegmentTree(transaction.trace.toJSON())
    assert.deepStrictEqual(foundSegments, expectedSegments)

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
