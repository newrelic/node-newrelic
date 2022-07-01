/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('../helpers')
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
    await helpers.build(__dirname)
    app = await helpers.start(__dirname)
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

    const res = await helpers.makeRequest(URI, app.server.port)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${URI}`,
        children: [
          {
            name: `${MW_PREFIX}/middleware`
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

    const res = await helpers.makeRequest(URI, app.server.port)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        children: [
          {
            name: `${MW_PREFIX}/middleware`
          },
          {
            name: `${SEGMENT_PREFIX}${EXPECTED_URI}`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test('should record segment for middleware when making API call', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const EXPECTED_URI = '/api/person/[id]'
    const URI = EXPECTED_URI.replace(/\[id\]/, '1')

    const res = await helpers.makeRequest(URI, app.server.port)

    t.equal(res.statusCode, 200)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        children: [
          {
            name: `${MW_PREFIX}/middleware`
          }
        ]
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })
})
