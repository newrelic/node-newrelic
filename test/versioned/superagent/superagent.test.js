/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { match } = require('../../lib/custom-assertions')
const helper = require('../../lib/agent_helper')
const testServer = require('./test-server')

const EXTERNAL_NAME = /External\/127.0.0.1:\d+\//

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const { address, server, stopServer } = await testServer()
  ctx.nr.address = address
  ctx.nr.server = server
  ctx.nr.stopServer = stopServer

  ctx.nr.request = require('superagent')
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['superagent'])
  await ctx.nr.stopServer()
})

// We no longer instrument `superagent`, but the tests
// are still here to make sure our new context manager
// is propagating correctly.

test('should maintain transaction context with callbacks', (t, end) => {
  const { address, agent, request } = t.nr

  helper.runInTransaction(agent, (tx) => {
    request.get(address, function testCallback() {
      assert.ok(tx)

      const [mainSegment] = tx.trace.getChildren(tx.trace.root.id)
      assert.ok(mainSegment)
      match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')

      end()
    })
  })
})

test('should not create a segment for callback if not in transaction', (t, end) => {
  const { address, agent, request } = t.nr
  request.get(address, function testCallback() {
    assert.equal(agent.getTransaction(), undefined, 'should not have a transaction')
    end()
  })
})

test('should maintain transaction context with promises', (t, end) => {
  const { address, agent, request } = t.nr
  helper.runInTransaction(agent, (tx) => {
    request.get(address).then(function testThen() {
      assert.ok(tx)

      const [mainSegment] = tx.trace.getChildren(tx.trace.root.id)
      assert.ok(mainSegment)
      match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')

      end()
    })
  })
})

test('should not create segment for a promise if not in a transaction', (t, end) => {
  const { address, agent, request } = t.nr
  request.get(address).then(function testThen() {
    assert.equal(agent.getTransaction(), undefined, 'should not have a transaction')
    end()
  })
})

test('should maintain transaction context with promises, async-await', (t, end) => {
  const { address, agent } = t.nr
  helper.runInTransaction(agent, async function (tx) {
    assert.ok(tx)

    const { request } = t.nr
    await request.get(address)

    const [mainSegment] = tx.trace.getChildren(tx.trace.root.id)
    assert.ok(mainSegment)
    match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')

    end()
  })
})

test('should not create segment if not in a transaction, async-await', async (t) => {
  const { address, agent, request } = t.nr
  await request.get(address)
  assert.equal(agent.getTransaction(), undefined, 'should not have a transaction')
})
