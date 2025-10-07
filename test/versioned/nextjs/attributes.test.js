/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helpers = require('./helpers')
const nextPkg = require('next/package.json')
const {
  isMiddlewareInstrumentationSupported
} = require('../../../lib/instrumentation/nextjs/utils')
const middlewareSupported = isMiddlewareInstrumentationSupported(nextPkg.version)
const agentHelper = require('../../lib/agent_helper')
const { assertPackageMetrics, match, assertCLMAttrs } = require('../../lib/custom-assertions')

test('Next.js', async (t) => {
  await helpers.build(__dirname)
  const agent = agentHelper.instrumentMockedAgent({
    attributes: {
      include: ['request.parameters.*']
    }
  })

  // TODO: would be nice to run a new server per test so there are not chained failures
  // but currently has issues. Potentially due to module caching.
  const server = await helpers.start(__dirname)

  t.after(async () => {
    await server.close()
    agentHelper.unloadAgent(agent)
  })

  await t.test('should log tracking metrics', function(t) {
    const { version } = require('next/package.json')
    assertPackageMetrics({ agent, pkg: 'next', version })
  })

  await t.test('should capture query params for static, non-dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/static/standard?first=one&second=two')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
  })

  await t.test(
    'should capture query and route params for static, dynamic route, page',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      const res = await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue')
      assert.equal(res.statusCode, 200)
      const [tx] = await txPromise

      const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

      match(agentAttributes, {
        'request.parameters.route.value': 'testing', // route [value] param
        'request.parameters.queryParam': 'queryValue'
      })

      assert.ok(!agentAttributes['request.parameters.route.queryParam'])
    }
  )

  await t.test(
    'should capture query params for server-side rendered, non-dynamic route, page',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })
      const res = await helpers.makeRequest('/ssr/people?first=one&second=two')
      assert.equal(res.statusCode, 200)
      const [tx] = await txPromise

      const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

      match(
        agentAttributes,
        {
          'request.parameters.first': 'one',
          'request.parameters.second': 'two'
        },
        'should match transaction attributes'
      )

      assert.ok(!agentAttributes['request.parameters.route.first'])
      assert.ok(!agentAttributes['request.parameters.route.second'])

      const segmentAttrs = helpers.getSegmentAgentAttributes(
        tx,
        'Nodejs/Nextjs/getServerSideProps//ssr/people'
      )
      match(
        segmentAttrs,
        {
          'next.page': '/ssr/people'
        },
        'should match segment attributes'
      )
    }
  )

  await t.test(
    'should capture query and route params for server-side rendered, dynamic route, page',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      const res = await helpers.makeRequest('/ssr/dynamic/person/1?queryParam=queryValue')
      assert.equal(res.statusCode, 200)
      const [tx] = await txPromise

      const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

      match(agentAttributes, {
        'request.parameters.route.id': '1', // route [id] param
        'request.parameters.queryParam': 'queryValue'
      })
      assert.ok(!agentAttributes['request.parameters.route.queryParam'])
      const segmentAttrs = helpers.getSegmentAgentAttributes(
        tx,
        'Nodejs/Nextjs/getServerSideProps//ssr/dynamic/person/[id]'
      )
      match(
        segmentAttrs,
        {
          'next.page': '/ssr/dynamic/person/[id]'
        },
        'should match segment attributes'
      )
    }
  )

  await t.test('should capture query params for API with non-dynamic route', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })
    const res = await helpers.makeRequest('/api/hello?first=one&second=two')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    match(agentAttributes, {
      'request.parameters.first': 'one',
      'request.parameters.second': 'two'
    })
    assert.ok(!agentAttributes['request.parameters.route.first'])
    assert.ok(!agentAttributes['request.parameters.route.second'])
  })

  await t.test('should capture query and route params for API with dynamic route', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/api/person/2?queryParam=queryValue')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    const agentAttributes = helpers.getTransactionEventAgentAttributes(tx)

    match(agentAttributes, {
      'request.parameters.route.id': '2', // route [id] param
      'request.parameters.queryParam': 'queryValue'
    })
    assert.ok(!agentAttributes['request.parameters.route.queryParam'])
  })

  await t.test(
    'should have matching traceId, sampled attributes across internal requests',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      const res = await helpers.makeRequest('/person/2')
      assert.equal(res.statusCode, 200)

      const transactions = await txPromise
      assert.equal(transactions.length, 2)

      const [transaction1, transaction2] = transactions

      const transaction1Attributes = helpers.getTransactionIntrinsicAttributes(transaction1)
      const transaction2Attributes = helpers.getTransactionIntrinsicAttributes(transaction2)

      assert.equal(transaction1Attributes.traceId, transaction2Attributes.traceId)
      assert.equal(transaction1Attributes.sampled, transaction2Attributes.sampled)
    }
  )

  for (const enabled of [true, false]) {
    await t.test(
      `should ${enabled ? 'add' : 'not add'} CLM attrs for API with dynamic route`,
      async (t) => {
        // need to define config like this as agent version could be less than
        // when this configuration was defined
        agent.config.code_level_metrics = { enabled }
        const txPromise = helpers.setupTransactionHandler({ t, agent })
        await helpers.makeRequest('/api/person/2?queryParam=queryValue')
        const [tx] = await txPromise
        const rootSegment = tx.trace.root
        const [handler] = tx.trace.getChildren(rootSegment.id)
        const segments = [
          {
            segment: handler,
            name: 'handler',
            filepath: 'pages/api/person/[id]'
          }
        ]
        if (middlewareSupported) {
          const [middleware] = tx.trace.getChildren(handler.id)
          segments.push({
            segment: middleware,
            name: 'middleware',
            filepath: 'middleware'
          })
        }
        assertCLMAttrs({
          segments,
          enabled,
          skipFull: true
        })
      }
    )

    await t.test(
      `should ${enabled ? 'add' : 'not add'} CLM attrs to server side page`,
      async (t) => {
        agent.config.code_level_metrics = { enabled }
        const txPromise = helpers.setupTransactionHandler({ t, agent })

        await helpers.makeRequest('/ssr/people')
        const [tx] = await txPromise
        const rootSegment = tx.trace.root
        const segments = []
        const [first] = tx.trace.getChildren(rootSegment.id)
        if (middlewareSupported) {
          const [middleware, getServerSideProps] = tx.trace.getChildren(first.id)
          segments.push({
            segment: middleware,
            name: 'middleware',
            filepath: 'middleware'
          })
          segments.push({
            segment: getServerSideProps,
            name: 'getServerSideProps',
            filepath: 'pages/ssr/people'
          })
        } else {
          segments.push({
            segment: helpers.getServerSidePropsSegment(tx.trace),
            name: 'getServerSideProps',
            filepath: 'pages/ssr/people'
          })
        }

        assertCLMAttrs({
          segments,
          enabled,
          skipFull: true
        })
      }
    )

    await t.test('should not add CLM attrs to static page segment', async (t) => {
      agent.config.code_level_metrics = { enabled }
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      await helpers.makeRequest('/static/dynamic/testing?queryParam=queryValue')
      const [tx] = await txPromise
      const rootSegment = tx.trace.root
      const [root] = tx.trace.getChildren(rootSegment.id)

      // The segment that names the static page will not contain CLM regardless of the
      // configuration flag
      assertCLMAttrs({
        segments: [{ segment: root }],
        enabled: false,
        skipFull: true
      })

      if (middlewareSupported) {
        const [middleware] = tx.trace.getChildren(root.id)
        // this will exist when CLM is enabled
        assertCLMAttrs({
          segments: [
            {
              segment: middleware,
              name: 'middleware',
              filepath: 'middleware'
            }
          ],
          enabled,
          skipFull: true
        })
      }
    })
  }
})
