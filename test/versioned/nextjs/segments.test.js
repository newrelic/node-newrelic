/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const semver = require('semver')
const helpers = require('./helpers')
const TRANSACTION_PREFX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'
const SEGMENT_PREFIX = 'Nodejs/Nextjs/getServerSideProps/'
const MW_PREFIX = 'Nodejs/Middleware/Nextjs/'
const nextPkg = require('next/package.json')
const {
  isMiddlewareInstrumentationSupported
} = require('../../../lib/instrumentation/nextjs/utils')
const agentHelper = require('../../lib/agent_helper')
const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')

function getChildSegments(uri) {
  const segments = [
    {
      name: `${SEGMENT_PREFIX}${uri}`,
      kind: 'internal'
    }
  ]

  if (isMiddlewareInstrumentationSupported(nextPkg.version)) {
    segments.unshift({
      name: `${MW_PREFIX}/middleware`,
      kind: 'internal'
    })
  }

  return segments
}

test('Next.js', async (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  // assigning the fake agent to the require cache because in
  // app/pages/_document we require the agent and want to not
  // try to bootstrap a new, real one
  agent.getBrowserTimingHeader = function getBrowserTimingHeader() {
    return '<div>stub</div>'
  }
  require.cache.__NR_cache = agent
  await helpers.build(__dirname)
  const server = await helpers.start(__dirname)

  t.after(async () => {
    await server.close()
    agentHelper.unloadAgent(agent)
  })

  await t.test('should properly name getServerSideProps segments on static pages', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const URI = '/ssr/people'

    const res = await helpers.makeRequest(URI)
    const [tx] = await txPromise

    assert.equal(res.statusCode, 200)
    const children = getChildSegments(URI)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${URI}`,
        kind: 'server',
        children
      }
    ]
    assertSegments(tx.trace, tx.trace.root, expectedSegments, { exact: false })
    assertSpanKind({ agent, segments: [expectedSegments[0], ...children] })
  })

  await t.test('should properly name getServerSideProps segments on dynamic pages', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const EXPECTED_URI = '/ssr/dynamic/person/[id]'
    const URI = EXPECTED_URI.replace(/\[id\]/, '1')

    const res = await helpers.makeRequest(URI)

    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise
    const children = getChildSegments(EXPECTED_URI)
    const expectedSegments = [
      {
        name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
        kind: 'server',
        children
      }
    ]
    assertSegments(tx.trace, tx.trace.root, expectedSegments, { exact: false })
    assertSpanKind({ agent, segments: [expectedSegments[0], ...children] })
  })

  await t.test(
    'should record segment for middleware when making API call',
    { skip: !isMiddlewareInstrumentationSupported(nextPkg.version) },
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent })

      const EXPECTED_URI = '/api/person/[id]'
      const URI = EXPECTED_URI.replace(/\[id\]/, '1')

      const res = await helpers.makeRequest(URI)

      assert.equal(res.statusCode, 200)
      const [tx] = await txPromise
      const expectedSegments = [
        {
          name: `${TRANSACTION_PREFX}${EXPECTED_URI}`,
          kind: 'server'
        }
      ]
      const segments = [expectedSegments[0]]

      if (semver.gte(nextPkg.version, '12.2.0')) {
        const segment = {
          name: `${MW_PREFIX}/middleware`,
          kind: 'internal'
        }
        expectedSegments[0].children = [segment]
        segments.push(segment)
      }

      assertSegments(tx.trace, tx.trace.root, expectedSegments, { exact: false })
      assertSpanKind({ agent, segments })
    }
  )
})
