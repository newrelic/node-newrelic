/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')

const EXTERNAL_NAME = /External\/newrelic.com(:443)*\//

tap.test('SuperAgent instrumentation with async/await', (t) => {
  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent()
    t.context.request = require('superagent')
  })
  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    Object.keys(require.cache).forEach((key) => {
      if (key.includes('superagent')) {
        delete require.cache[key]
      }
    })
  })

  t.test('should maintain transaction context with promises', (t) => {
    const { agent } = t.context
    helper.runInTransaction(agent, async function (tx) {
      t.ok(tx)

      const { request } = t.context
      await request.get('https://newrelic.com')

      const mainSegment = tx.trace.root.children[0]
      t.ok(mainSegment)
      t.match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')
      t.equal(
        mainSegment.children.filter((c) => c.name === 'Callback: <anonymous>').length,
        1,
        'CB created by superagent is present'
      )

      t.end()
    })
  })

  t.test('should not create segment if not in a transaction', async (t) => {
    const { agent, request } = t.context
    await request.get('https://newrelic.com')
    t.notOk(agent.getTransaction(), 'should not have a transaction')
    t.end()
  })

  t.end()
})
