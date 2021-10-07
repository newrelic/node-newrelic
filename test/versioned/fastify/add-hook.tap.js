/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const util = require('util')
const requestClient = require('request')
const getAsync = util.promisify(requestClient.get)
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')

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

function getSegmentNames(hooks) {
  return hooks.map((hookName) => {
    return `Nodejs/Middleware/Fastify/${hookName}/testHook`
  })
}

tap.test('fastify hook instrumentation', (t) => {
  t.autoend()

  let agent = null
  let fastify = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true
      }
    })
    fastify = require('fastify')()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  t.test('non-error hooks', async function nonErrorHookTest(t) {
    // setup fastify route
    fastify.get('/', function routeHandler(_, reply) {
      t.comment('route handler called')
      reply.send({ hello: 'world' })
    })

    // setup hooks
    const ok = ALL_HOOKS.reduce((all, hookName) => {
      t.comment(`registering ${hookName}`)
      all[hookName] = false
      return all
    }, {})

    ALL_HOOKS.forEach((hookName) => {
      fastify.addHook(hookName, function testHook(...args) {
        t.comment(`${hookName} called`)
        // lifecycle signatures vary between the events
        // the last arg is always the next function though
        const next = args[args.length - 1]
        ok[hookName] = true
        next()
      })
    })

    agent.on('transactionFinished', (transaction) => {
      t.equal('WebFrameworkUri/Fastify/GET//', transaction.getName(), `transaction name matched`)
      // all the hooks are siblings of the route handler
      // except the AFTER_HANDLER_HOOKS which are children of the route handler
      metrics.assertSegments(transaction.trace.root, [
        'WebTransaction/WebFrameworkUri/Fastify/GET//',
        [
          ...getSegmentNames(REQUEST_HOOKS),
          'Nodejs/Middleware/Fastify/routeHandler',
          getSegmentNames(AFTER_HANDLER_HOOKS)
        ]
      ])
    })

    await fastify.listen(0)
    const { port } = fastify.server.address()
    const result = await getAsync(`http://127.0.0.1:${port}/`)
    t.equal(result.statusCode, 200)
    t.equal(result.body, JSON.stringify({ hello: 'world' }))

    // verify every hook was called after response
    for (const [hookName, isOk] of Object.entries(ok)) {
      t.equal(isOk, true, `${hookName} captured`)
    }
    t.end()
  })

  t.test('error hook', async function errorHookTest(t) {
    // setup fastify route
    fastify.get('/', async function routeHandler() {
      throw new Error('sup')
    })

    const hookName = 'onError'
    let ok = false

    fastify.addHook(hookName, function testHook(req, reply, err, next) {
      t.equal(err.message, 'sup', 'error message correct')
      ok = true
      next()
    })

    agent.on('transactionFinished', (transaction) => {
      t.equal('WebFrameworkUri/Fastify/GET//', transaction.getName(), `transaction name matched`)
      // all the hooks are siblings of the route handler
      metrics.assertSegments(transaction.trace.root, [
        'WebTransaction/WebFrameworkUri/Fastify/GET//',
        [
          'Nodejs/Middleware/Fastify/routeHandler',
          [`Nodejs/Middleware/Fastify/${hookName}/testHook`]
        ]
      ])
    })

    await fastify.listen(0)
    const { port } = fastify.server.address()
    const result = await getAsync(`http://127.0.0.1:${port}/`)
    t.ok(ok)
    t.equal(result.statusCode, 500)
    t.equal(result.body, '{"statusCode":500,"error":"Internal Server Error","message":"sup"}')
    t.end()
  })
})
