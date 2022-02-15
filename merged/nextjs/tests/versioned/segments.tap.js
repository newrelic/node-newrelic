/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')
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

    const res = await helpers.makeRequest('/ssr/people')
    t.equal(res.statusCode, 200)
    const segments = transaction.trace.root.children[0].children
    t.equal(segments.length, 3, 'should have 3 segments')
    const [rootMw, ssrMw, ssrSegment] = segments
    t.equal(rootMw.name, `${MW_PREFIX}/_middleware`, 'root middleware should match')
    t.equal(ssrMw.name, `${MW_PREFIX}/ssr/_middleware`, 'ssr middleware should match')
    t.equal(ssrSegment.name, `${SEGMENT_PREFIX}/ssr/people`, 'getServerSideProps should match')
  })

  t.test('should properly name getServerSideProps segments on dynamic pages', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const res = await helpers.makeRequest('/ssr/dynamic/person/1')
    t.equal(res.statusCode, 200)
    const segments = transaction.trace.root.children[0].children
    t.equal(segments.length, 4, 'should have 4 segments')
    const [rootMw, ssrMw, ssrDynamicMw, ssrSegment] = segments
    t.equal(rootMw.name, `${MW_PREFIX}/_middleware`, 'root middleware should match')
    t.equal(ssrMw.name, `${MW_PREFIX}/ssr/_middleware`, 'ssr middleware should match')
    t.equal(
      ssrDynamicMw.name,
      `${MW_PREFIX}/ssr/dynamic/_middleware`,
      'ssr dynamic middleware should match'
    )
    t.equal(
      ssrSegment.name,
      `${SEGMENT_PREFIX}/ssr/dynamic/person/[id]`,
      'getServerSideProps should match'
    )
  })

  t.test('should record segment for every layer of API middlewares', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const res = await helpers.makeRequest('/api/person/1')
    t.equal(res.statusCode, 200)

    const segments = transaction.trace.root.children[0].children
    t.equal(segments.length, 3, 'should have 3 segments')
    const [rootMw, apiMw, personApiMw] = segments
    t.equal(rootMw.name, `${MW_PREFIX}/_middleware`, 'root middleware should match')
    t.equal(apiMw.name, `${MW_PREFIX}/api/_middleware`, 'api middleware should match')
    t.equal(
      personApiMw.name,
      `${MW_PREFIX}/api/person/_middleware`,
      'person api middleware should match'
    )
    t.end()
  })

  t.test('should record 2 API middlewares when applicable', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const res = await helpers.makeRequest('/api/hello')
    t.equal(res.statusCode, 200)

    const segments = transaction.trace.root.children[0].children
    t.equal(segments.length, 2, 'should have 2 segments')
    const [rootMw, apiMw] = segments
    t.equal(rootMw.name, `${MW_PREFIX}/_middleware`, 'root middleware should match')
    t.equal(apiMw.name, `${MW_PREFIX}/api/_middleware`, 'api middleware should match')
    t.end()
  })

  t.test('should record 2 page middlewares when applicable', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const res = await helpers.makeRequest('/person/1')
    t.equal(res.statusCode, 200)

    const segments = transaction.trace.root.children[0].children
    t.equal(segments.length, 3, 'should have 3 segments')
    const [rootMw, apiMw, ssrSegment] = segments
    t.equal(rootMw.name, `${MW_PREFIX}/_middleware`, 'root middleware should match')
    t.equal(apiMw.name, `${MW_PREFIX}/person/_middleware`, 'person middleware should match')
    t.equal(ssrSegment.name, `${SEGMENT_PREFIX}/person/[id]`, 'getServerSideProps should match')
    t.end()
  })
})
