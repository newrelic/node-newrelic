/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const nextPkg = require('next/package.json')
const {
  isMiddlewareInstrumentationSupported,
  getServerSidePropsSegment
} = require('../../../lib/instrumentation/nextjs/utils')
const middlewareSupported = isMiddlewareInstrumentationSupported(nextPkg.version)
const agentHelper = require('../../lib/agent_helper')

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let server

  t.before(async () => {
    await helpers.build(__dirname)
    agent = agentHelper.instrumentMockedAgent({
      attributes: {
        include: ['request.parameters.*']
      }
    })

    // TODO: would be nice to run a new server per test so there are not chained failures
    // but currently has issues. Potentially due to module caching.
    server = await helpers.start(__dirname)
  })

  t.teardown(async () => {
    await server.close()
    agentHelper.unloadAgent(agent)
  })

  t.test('should capture query params for static, non-dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/static/standard?first=one&second=two')
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
  })

  t.test('should capture query and route params for static, dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue')
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.route.value': 'testing', // route [value] param
      'request.parameters.queryParam': 'queryValue'
    })

    t.notOk(agentAttributes['request.parameters.route.queryParam'])
  })

  t.test(
    'should capture query params for server-side rendered, non-dynamic route, page',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })
      const res = await helpers.makeRequest('/ssr/people?first=one&second=two')
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

      const segmentAttrs = helpers.getSegmentAgentAttributes(
        tx,
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
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      const res = await helpers.makeRequest('/ssr/dynamic/person/1?queryParam=queryValue')
      t.equal(res.statusCode, 200)
      const [tx] = await txPromise

      const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

      t.match(agentAttributes, {
        'request.parameters.route.id': '1', // route [id] param
        'request.parameters.queryParam': 'queryValue'
      })
      t.notOk(agentAttributes['request.parameters.route.queryParam'])
      const segmentAttrs = helpers.getSegmentAgentAttributes(
        tx,
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
    const txPromise = helpers.setupTransactionHandler({ t, agent })
    const res = await helpers.makeRequest('/api/hello?first=one&second=two')
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
    t.notOk(agentAttributes['request.parameters.route.first'])
    t.notOk(agentAttributes['request.parameters.route.second'])
  })

  t.test('should capture query and route params for API with dynamic route', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/api/person/2?queryParam=queryValue')
    t.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    t.match(agentAttributes, {
      'request.parameters.route.id': '2', // route [id] param
      'request.parameters.queryParam': 'queryValue'
    })
    t.notOk(agentAttributes['request.parameters.route.queryParam'])
  })

  t.test('should have matching traceId, sampled attributes across internal requests', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/person/2')
    t.equal(res.statusCode, 200)

    const transactions = await txPromise
    t.equal(transactions.length, 2)

    const [transaction1, transaction2] = transactions

    const transaction1Attributes = helpers.getTransactionIntrinsicAttributes(transaction1)
    const transaction2Attributes = helpers.getTransactionIntrinsicAttributes(transaction2)

    t.equal(transaction1Attributes.traceId, transaction2Attributes.traceId)
    t.equal(transaction1Attributes.sampled, transaction2Attributes.sampled)
  })
  ;[true, false].forEach((enabled) => {
    t.test(
      `should ${enabled ? 'add' : 'not add'} CLM attrs for API with dynamic route`,
      async (t) => {
        // need to define config like this as agent version could be less than
        // when this configuration was defined
        agent.config.code_level_metrics = { enabled }
        const txPromise = helpers.setupTransactionHandler({ t, agent })
        await helpers.makeRequest('/api/person/2?queryParam=queryValue')
        const [tx] = await txPromise
        const rootSegment = tx.trace.root
        const segments = [
          {
            segment: rootSegment.children[0],
            name: 'handler',
            filepath: 'pages/api/person/[id]'
          }
        ]
        if (middlewareSupported) {
          segments.push({
            segment: rootSegment.children[0].children[0],
            name: 'middleware',
            filepath: 'middleware'
          })
        }
        t.clmAttrs({
          segments,
          enabled,
          skipFull: true
        })
      }
    )

    t.test(`should ${enabled ? 'add' : 'not add'} CLM attrs to server side page`, async (t) => {
      agent.config.code_level_metrics = { enabled }
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      await helpers.makeRequest('/ssr/people')
      const [tx] = await txPromise
      const rootSegment = tx.trace.root
      const segments = []
      if (middlewareSupported) {
        segments.push({
          segment: rootSegment.children[0].children[0],
          name: 'middleware',
          filepath: 'middleware'
        })
        segments.push({
          segment: rootSegment.children[0].children[1],
          name: 'getServerSideProps',
          filepath: 'pages/ssr/people'
        })
      } else {
        segments.push({
          segment: getServerSidePropsSegment(rootSegment),
          name: 'getServerSideProps',
          filepath: 'pages/ssr/people'
        })
      }

      t.clmAttrs({
        segments,
        enabled,
        skipFull: true
      })
    })

    t.test('should not add CLM attrs to static page segment', async (t) => {
      agent.config.code_level_metrics = { enabled }
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue')
      const [tx] = await txPromise
      const rootSegment = tx.trace.root

      // The segment that names the static page will not contain CLM regardless of the
      // configuration flag
      t.clmAttrs({
        segments: [{ segment: rootSegment.children[0] }],
        enabled: false,
        skipFull: true
      })

      if (middlewareSupported) {
        // this will exist when CLM is enabled
        t.clmAttrs({
          segments: [
            {
              segment: rootSegment.children[0].children[0],
              name: 'middleware',
              filepath: 'middleware'
            }
          ],
          enabled,
          skipFull: true
        })
      }
    })
  })
})
