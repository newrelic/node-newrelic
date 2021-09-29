/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const requestClient = require('request')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')

const REQUEST_HOOKS = [
  'onRequest',
  'preParsing',
  // 'preValidation',
  // 'preHandler',
  // 'preSerialization',
  'onSend',
  'onResponse'
]

tap.test(function (t) {
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

    fastify.get('/', function helloWorld() {
      return { hello: 'world' }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  t.test('should wrap all lifecycle hooks', async function (t) {
    // setup hooks
    const ok = REQUEST_HOOKS.reduce((all, hookName) => {
      all[hookName] = false
      return all
    }, {})
    for (const hookName of REQUEST_HOOKS) {
      fastify.addHook(hookName, function testHook(req, res, next) {
        ok[hookName] = true
        next()
      })
    }
    // setup transaction monitor
    const promise = new Promise((resolve) => {
      agent.on('transactionFinished', (transaction) => {
        t.equal('WebFrameworkUri/Fastify/GET//', transaction.getName(), `transaction name matched`)
        metrics.assertSegments(transaction.trace.root, [
          'WebTransaction/WebFrameworkUri/Fastify/GET//',
          [
            'Nodejs/Middleware/Fastify/onRequest/testHook',
            'Nodejs/Middleware/Fastify/preParsing/testHook',
            'Nodejs/Middleware/Fastify/onSend/testHook'
          ]
        ])
        resolve()
      })
    })
    // start and ping the server
    await fastify.listen(0)
    const { port } = fastify.server.address()
    await requestClient.get(`http://127.0.0.1:${port}/`)
    await promise
    // validate
    for (const [hookName, isOk] of Object.entries(ok)) {
      t.equal(isOk, true, `${hookName} captured`)
    }
    t.end()
  })
})
