/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')
const TRANSACTION_PREFX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'
const SEGMENT_PREFIX = 'Nodejs/Nextjs/getServerSideProps/'
const MW_PREFIX = 'Nodejs/Middleware/Nextjs/'

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let app

  t.before(async () => {
    agent = utils.TestAgent.makeInstrumented()
    helpers.registerInstrumentation(agent)
    await helpers.build()
    app = await helpers.start()
  })

  t.teardown(() => {
    app.options.httpServer.close()
    agent.unload()
  })

  t.test('should properly name getServerSideProps segments on static pages', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const URI = '/ssr/people'

    const res = await helpers.makeRequest(URI)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${URI}`,
        children: [
          {
            name: `${MW_PREFIX}/_middleware`
          },
          {
            name: `${MW_PREFIX}/ssr/_middleware`
          },
          {
            name: `${SEGMENT_PREFIX}${URI}`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test('should properly name getServerSideProps segments on dynamic pages', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const EXPECTED_URI = '/ssr/dynamic/person/[id]'
    const URI = EXPECTED_URI.replace(/\[id\]/, '1')

    const res = await helpers.makeRequest(URI)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        children: [
          {
            name: `${MW_PREFIX}/_middleware`
          },
          {
            name: `${MW_PREFIX}/ssr/_middleware`
          },
          {
            name: `${MW_PREFIX}/ssr/dynamic/_middleware`
          },
          {
            name: `${SEGMENT_PREFIX}${EXPECTED_URI}`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test('should record segment for every layer of API middlewares', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const EXPECTED_URI = '/api/person/[id]'
    const URI = EXPECTED_URI.replace(/\[id\]/, '1')

    const res = await helpers.makeRequest(URI)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        children: [
          {
            name: `${MW_PREFIX}/_middleware`
          },
          {
            name: `${MW_PREFIX}/api/_middleware`
          },
          {
            name: `${MW_PREFIX}/api/person/_middleware`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test('should record 2 API middlewares when applicable', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const URI = '/api/hello'
    const res = await helpers.makeRequest(URI)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${URI}`,
        children: [
          {
            name: `${MW_PREFIX}/_middleware`
          },
          {
            name: `${MW_PREFIX}/api/_middleware`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test('should record 2 page middlewares when applicable', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const EXPECTED_URI = '/person/[id]'
    const URI = EXPECTED_URI.replace(/\[id\]/, '1')

    const res = await helpers.makeRequest(URI)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        children: [
          {
            name: `${MW_PREFIX}/_middleware`
          },
          {
            name: `${MW_PREFIX}/person/_middleware`
          },
          {
            name: `${SEGMENT_PREFIX}${EXPECTED_URI}`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })
})
