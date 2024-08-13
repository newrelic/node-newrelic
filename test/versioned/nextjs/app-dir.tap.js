/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const NEXT_TRANSACTION_PREFIX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'
const agentHelper = require('../../lib/agent_helper')

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let server

  t.before(async () => {
    await helpers.build(__dirname, 'app-dir')
    agent = agentHelper.instrumentMockedAgent({
      attributes: {
        include: ['request.parameters.*']
      }
    })

    // TODO: would be nice to run a new server per test so there are not chained failures
    // but currently has issues. Potentially due to module caching.
    server = await helpers.start(__dirname, 'app-dir', '3002')
  })

  t.teardown(async () => {
    await server.close()
    agentHelper.unloadAgent(agent)
  })

  t.test('should capture query params for static, non-dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/static/standard?first=one&second=two', 3002)
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
    t.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/static/standard`)
  })

  t.test('should capture query and route params for static, dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue', 3002)
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.route.value': 'testing', // route [value] param
      'request.parameters.queryParam': 'queryValue'
    })

    t.notOk(agentAttributes['request.parameters.route.queryParam'])
    t.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/static/dynamic/[value]`)
  })

  t.test(
    'should capture query params for server-side rendered, non-dynamic route, page',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })
      const res = await helpers.makeRequest('/person/1?first=one&second=two', 3002)
      t.equal(res.statusCode, 200)
      const [tx] = await txPromise

      const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

      t.match(
        agentAttributes,
        {
          'request.parameters.first': 'one',
          'request.parameters.second': 'two'
        },
        'should match transaction attributes'
      )

      t.notOk(agentAttributes['request.parameters.route.first'])
      t.notOk(agentAttributes['request.parameters.route.second'])
      t.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/person/[id]`)
    }
  )
})
