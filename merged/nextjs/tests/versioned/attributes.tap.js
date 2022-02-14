/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')

const DESTINATIONS = {
  NONE: 0x00,
  TRANS_EVENT: 0x01,
  TRANS_TRACE: 0x02,
  ERROR_EVENT: 0x04,
  BROWSER_EVENT: 0x08,
  SPAN_EVENT: 0x10,
  TRANS_SEGMENT: 0x20
}

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let app

  t.before(async () => {
    await helpers.build()

    agent = utils.TestAgent.makeInstrumented({
      attributes: {
        include: ['request.parameters.*']
      }
    })
    helpers.registerInstrumentation(agent)

    // TODO: would be nice to run a new server per test so there are not chained failures
    // but currently has issues. Potentially due to module caching.
    app = await helpers.start()
  })

  t.teardown(() => {
    app.options.httpServer.close()
    agent.unload()
  })

  t.test('should capture query params for static, non-dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/static/standard?first=one&second=two')
    t.equal(res.statusCode, 200)

    const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
  })

  t.test('should capture query and route params for static, dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue')
    t.equal(res.statusCode, 200)

    const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

    t.match(agentAttributes, {
      'request.parameters.value': 'testing', // route [value] param
      'request.parameters.queryParam': 'queryValue'
    })
  })

  t.test(
    'should capture query params for server-side rendered, non-dynamic route, page',
    async (t) => {
      let endedTransaction = null
      agent.agent.on('transactionFinished', (transaction) => {
        endedTransaction = transaction
      })

      const res = await helpers.makeRequest('/ssr/people?first=one&second=two')
      t.equal(res.statusCode, 200)

      const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

      t.match(
        agentAttributes,
        {
          'request.parameters.first': 'one',
          'request.parameters.second': 'two'
        },
        'should match transaction attributes'
      )

      const segmentAttrs = getSegmentAgentAttributes(
        endedTransaction,
        'Nodejs/Nextjs/getServerSideProps//ssr/people'
      )
      t.match(
        segmentAttrs,
        {
          'next.page': '/ssr/people'
        },
        'should match segment attributes'
      )
    }
  )

  t.test(
    'should capture query and route params for server-side rendered, dynamic route, page',
    async (t) => {
      let endedTransaction = null
      agent.agent.on('transactionFinished', (transaction) => {
        endedTransaction = transaction
      })

      const res = await helpers.makeRequest('/ssr/dynamic/person/1?queryParam=queryValue')
      t.equal(res.statusCode, 200)

      const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

      t.match(agentAttributes, {
        'request.parameters.id': '1', // route [id] param
        'request.parameters.queryParam': 'queryValue'
      })
      const segmentAttrs = getSegmentAgentAttributes(
        endedTransaction,
        'Nodejs/Nextjs/getServerSideProps//ssr/dynamic/person/[id]'
      )
      t.match(
        segmentAttrs,
        {
          'next.page': '/ssr/dynamic/person/[id]'
        },
        'should match segment attributes'
      )
    }
  )

  t.test('should capture query params for API with non-dynamic route', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/api/hello?first=one&second=two')
    t.equal(res.statusCode, 200)

    const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
  })

  t.test('should capture query and route params for API with dynamic route', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/api/person/2?queryParam=queryValue')
    t.equal(res.statusCode, 200)

    const agentAttributes = getTransactionEventAgentAttributes(endedTransaction)

    t.match(agentAttributes, {
      'request.parameters.id': '2', // route [id] param
      'request.parameters.queryParam': 'queryValue'
    })
  })

  t.test('should have matching traceId, sampled attributes across internal requests', async (t) => {
    const transactions = []
    agent.agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction)
    })

    const res = await helpers.makeRequest('/person/2')
    t.equal(res.statusCode, 200)

    t.equal(transactions.length, 2)

    const [transaction1, transaction2] = transactions

    const transaction1Attributes = getTransactionIntrinsicAttributes(transaction1)
    const transaction2Attributes = getTransactionIntrinsicAttributes(transaction2)

    t.equal(transaction1Attributes.traceId, transaction2Attributes.traceId)
    t.equal(transaction1Attributes.sampled, transaction2Attributes.sampled)
  })

  function getTransactionEventAgentAttributes(transaction) {
    return transaction.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
  }

  function getTransactionIntrinsicAttributes(transaction) {
    return transaction.trace.intrinsics
  }

  function getSegmentAgentAttributes(transaction, name) {
    const segment = helpers.findSegmentByName(transaction.trace.root, name)
    if (segment) {
      return segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    }

    return {}
  }
})
