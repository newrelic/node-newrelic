/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')
const SEGMENT_PREFIX = 'Nodejs/Nextjs/getServerSideProps/'

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
    const root = transaction.trace.root.children[0]
    const nextSegment = root.children[1]
    t.equal(nextSegment.name, `${SEGMENT_PREFIX}/ssr/people`)
  })

  t.test('should properly name getServerSideProps segments on dynamic pages', async (t) => {
    let transaction
    agent.agent.on('transactionFinished', function (tx) {
      transaction = tx
    })

    const res = await helpers.makeRequest('/ssr/dynamic/person/1')
    t.equal(res.statusCode, 200)
    const root = transaction.trace.root.children[0]
    const nextSegment = root.children[1]
    t.equal(nextSegment.name, `${SEGMENT_PREFIX}/ssr/dynamic/person/[id]`)
  })
})
