/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const semver = require('semver')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')
const TRANSACTION_PREFX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'
const SEGMENT_PREFIX = 'Nodejs/Nextjs/getServerSideProps/'
const MW_PREFIX = 'Nodejs/Middleware/Nextjs/'
const nextPkg = require('next/package.json')
const { isMiddlewareInstrumentationSupported } = require('../../lib/utils')

function getChildSegments(uri) {
  const segments = [
    {
      name: `${SEGMENT_PREFIX}${uri}`
    }
  ]

  if (isMiddlewareInstrumentationSupported(nextPkg.version)) {
    segments.unshift({
      name: `${MW_PREFIX}/middleware`
    })
  }

  return segments
}

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let server

  t.before(async () => {
    agent = utils.TestAgent.makeInstrumented()
    // assigning the fake agent to the require cache because in
    // app/pages/_document we require the agent and want to not
    // try to bootstrap a new, real one
    agent.agent.getBrowserTimingHeader = function getBrowserTimingHeader() {
      return '<div>stub</div>'
    }
    require.cache.__NR_cache = agent.agent
    helpers.registerInstrumentation(agent)
    await helpers.build(__dirname)
    server = await helpers.start(__dirname)
  })

  t.teardown(async () => {
    await server.close()
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
        children: getChildSegments(URI)
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
        children: getChildSegments(EXPECTED_URI)
      }
    ]
    t.segments(transaction.trace.root, expectedSegments)
  })

  t.test(
    'should record segment for middleware when making API call',
    { skip: !isMiddlewareInstrumentationSupported(nextPkg.version) },
    async (t) => {
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
          name: `${TRANSACTION_PREFX}${EXPECTED_URI}`
        }
      ]

      if (semver.gte(nextPkg.version, '12.2.0')) {
        expectedSegments[0].children = [
          {
            name: `${MW_PREFIX}/middleware`
          }
        ]
      }

      t.segments(transaction.trace.root, expectedSegments)
    }
  )
})
