/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')

tap.test('next-context', (t) => {
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
    let transactions = 0
    agent.agent.on('transactionFinished', function (tx) {
      transactions++
      const name =
        transactions === 1
          ? 'WebTransaction/WebFrameworkUri/Nextjs/GET//api/person/[id]'
          : 'WebTransaction/WebFrameworkUri/Nextjs/GET//person/[id]'
      t.equal(tx.name, name, 'should properly name Next transaction')
    })

    return helpers.makeRequest('/api/person/1').then((res) => {
      t.equal(transactions, 2, 'should be 2 transactions')
      t.equal(res.statusCode, 200)
      t.end()
    })
  })
})
