/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')

tap.test('middleware tracking', (t) => {
  t.autoend()

  let agent
  let app

  t.beforeEach(async () => {
    agent = utils.TestAgent.makeInstrumented()
    agent.registerInstrumentation({
      moduleName: './context',
      type: 'web-framework',
      onRequire: require('../../lib/context')
    })

    await helpers.build()
    app = await helpers.start()
  })

  t.afterEach(() => {
    app.options.httpServer.close()
    agent.unload()
  })

  t.test('records middleware', async (t) => {
    const txPromise = new Promise((resolve) => {
      agent.agent.on('transactionFinished', resolve)
    })
    const res = await helpers.makeRequest('/api/person/1')
    t.equal(res.statusCode, 200)

    const tx = await txPromise
    t.equal(tx.name, 'WebTransaction/NormalizedUri/*')
    t.equal(tx.trace.root.children[0].children.length, 3)
    const [mw1, mw2, mw3] = tx.trace.root.children[0].children
    t.equal(mw1.name, 'Nodejs/Middleware/Nextjs//_middleware')
    t.equal(mw2.name, 'Nodejs/Middleware/Nextjs//api/_middleware')
    t.equal(mw3.name, 'Nodejs/Middleware/Nextjs//api/person/_middleware')

    tx.end()
    t.end()
  })
})
