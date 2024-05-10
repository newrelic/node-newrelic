/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const testServer = require('./test-server')
const { removeModules } = require('../../lib/cache-buster')
const EXTERNAL_NAME = /External\/127.0.0.1:\d+\//

tap.test('SuperAgent instrumentation with async/await', (t) => {
  t.beforeEach(async (t) => {
    const { address, server, stopServer } = await testServer()
    t.context.address = address
    t.context.server = server
    t.context.stopServer = stopServer

    t.context.agent = helper.instrumentMockedAgent()
    t.context.request = require('superagent')
  })
  t.afterEach(async (t) => {
    helper.unloadAgent(t.context.agent)
    removeModules(['superagent'])

    await t.context.stopServer()
  })

  t.test('should maintain transaction context with promises', (t) => {
    const { address, agent } = t.context
    helper.runInTransaction(agent, async function (tx) {
      t.ok(tx)

      const { request } = t.context
      await request.get(address)

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
    const { address, agent, request } = t.context
    await request.get(address)
    t.notOk(agent.getTransaction(), 'should not have a transaction')
    t.end()
  })

  t.end()
})
