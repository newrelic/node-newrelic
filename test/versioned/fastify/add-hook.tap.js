/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
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
  return hooks.map((hookName) => {
    return `Nodejs/Middleware/Fastify/${hookName}/testHook`
  })
}

tap.test('fastify hook instrumentation', (t) => {
  t.autoend()
  t.beforeEach(() => {
    const agent = helper.instrumentMockedAgent()
    const fastify = require('fastify')()
    common.setupRoutes(fastify)
    t.context.agent = agent
    t.context.fastify = fastify
  })

  t.afterEach(() => {
    const { fastify, agent } = t.context
    helper.unloadAgent(agent)
    fastify.close()
  })

  t.test('non-error hooks', async function nonErrorHookTest(t) {
    const { fastify, agent } = t.context

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

    agent.on('transactionFinished', (transaction) => {
      t.equal(
        'WebFrameworkUri/Fastify/GET//add-hook',
        transaction.getName(),
        `transaction name matched`
      )
      // all the hooks are siblings of the route handler
      // except the AFTER_HANDLER_HOOKS which are children of the route handler
      metrics.assertSegments(transaction.trace.root, [
        'WebTransaction/WebFrameworkUri/Fastify/GET//add-hook',
        [
          ...getExpectedSegments(REQUEST_HOOKS),
          'Nodejs/Middleware/Fastify/routeHandler//add-hook',
          getExpectedSegments(AFTER_HANDLER_HOOKS)
        ]
      ])
    })

    await fastify.listen(0)
    const { port } = fastify.server.address()
    const result = await common.makeRequest(`http://127.0.0.1:${port}/add-hook`)
    t.same(result, { hello: 'world' })

    // verify every hook was called after response
    for (const [hookName, isOk] of Object.entries(ok)) {
      t.equal(isOk, true, `${hookName} captured`)
    }
    t.end()
  })

  t.test('error hook', async function errorHookTest(t) {
    const { fastify, agent } = t.context

    const hookName = 'onError'
    let ok = false

    fastify.addHook(hookName, function testHook(req, reply, err, next) {
      t.equal(err.message, 'test onError hook', 'error message correct')
      ok = true
      next()
    })

    agent.on('transactionFinished', (transaction) => {
      t.equal(
        'WebFrameworkUri/Fastify/GET//error',
        transaction.getName(),
        `transaction name matched`
      )
      // all the hooks are siblings of the route handler
      metrics.assertSegments(transaction.trace.root, [
        'WebTransaction/WebFrameworkUri/Fastify/GET//error',
        [
          'Nodejs/Middleware/Fastify/errorRoute//error',
          [`Nodejs/Middleware/Fastify/${hookName}/testHook`]
        ]
      ])
    })

    await fastify.listen(0)
    const { port } = fastify.server.address()
    const result = await common.makeRequest(`http://127.0.0.1:${port}/error`)
    t.ok(ok)
    t.same(result, {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'test onError hook'
    })
    t.end()
  })
})
