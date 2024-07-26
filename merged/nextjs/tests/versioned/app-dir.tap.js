/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')
const NEXT_TRANSACTION_PREFIX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'
const DESTINATIONS = {
  NONE: 0x00,
  TRANS_EVENT: 0x01,
  TRANS_TRACE: 0x02,
  ERROR_EVENT: 0x04,
  BROWSER_EVENT: 0x08,
  SPAN_EVENT: 0x10,
  TRANS_SEGMENT: 0x20
}

tap.Test.prototype.addAssert('nextCLMAttrs', 1, function ({ segments, clmEnabled }) {
  segments.forEach(({ segment, name, filepath }) => {
    const attrs = segment.getAttributes()
    if (clmEnabled) {
      this.match(
        attrs,
        {
          'code.function': name,
          'code.filepath': filepath
        },
        'should add code.function and code.filepath when CLM is enabled.'
      )
    } else {
      this.notOk(attrs['code.function'], 'should not add code.function when CLM is disabled.')
      this.notOk(attrs['code.filepath'], 'should not add code.filepath when CLM is disabled.')
    }
  })
})

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let server

  t.before(async () => {
    await helpers.build(__dirname, 'app-dir')

    agent = utils.TestAgent.makeInstrumented({
      attributes: {
        include: ['request.parameters.*']
      }
    })
    helpers.registerInstrumentation(agent)

    // TODO: would be nice to run a new server per test so there are not chained failures
    // but currently has issues. Potentially due to module caching.
    server = await helpers.start(__dirname, 'app-dir', '3002')
  })

  t.teardown(async () => {
    await server.close()
    agent.unload()
  })

  // since we setup agent in before we need to remove
  // the transactionFinished listener between tests to avoid
  // context leaking
  function setupTransactionHandler(t) {
    return new Promise((resolve) => {
      function txHandler(transaction) {
        resolve(transaction)
      }

      agent.agent.on('transactionFinished', txHandler)

      t.teardown(() => {
        agent.agent.removeListener('transactionFinished', txHandler)
      })
    })
  }

  t.test('should capture query params for static, non-dynamic route, page', async (t) => {
    const prom = setupTransactionHandler(t)

    const res = await helpers.makeRequest('/static/standard?first=one&second=two', 3002)
    t.equal(res.statusCode, 200)
    const tx = await prom

    const agentAttributes = getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
    t.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/static/standard`)
  })

  t.test('should capture query and route params for static, dynamic route, page', async (t) => {
    const prom = setupTransactionHandler(t)

    const res = await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue', 3002)
    t.equal(res.statusCode, 200)
    const tx = await prom

    const agentAttributes = getTransactionEventAgentAttributes(tx)

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
      const prom = setupTransactionHandler(t)
      const res = await helpers.makeRequest('/person/1?first=one&second=two', 3002)
      t.equal(res.statusCode, 200)
      const tx = await prom

      const agentAttributes = getTransactionEventAgentAttributes(tx)

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

  function getTransactionEventAgentAttributes(transaction) {
    return transaction.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
  }
})
