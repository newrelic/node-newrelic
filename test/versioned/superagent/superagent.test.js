/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, match } = require('../../lib/custom-assertions')
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

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('superagent/package.json')
  assertPackageMetrics({ agent, pkg: 'superagent', version })
})

test('should maintain transaction context with callbacks', (t, end) => {
  const { address, agent, request } = t.nr

  helper.runInTransaction(agent, (tx) => {
    request.get(address, function testCallback() {
      assert.ok(tx)

      const [mainSegment] = tx.trace.getChildren(tx.trace.root.id)
      assert.ok(mainSegment)
      match(mainSegment.name, EXTERNAL_NAME, 'has segment matching request')
      const mainChildren = tx.trace.getChildren(mainSegment.id)
      assert.equal(
        mainChildren.filter((c) => c.name === 'Callback: testCallback').length,
        1,
        'has segment matching callback'
      )

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
      const mainChildren = tx.trace.getChildren(mainSegment.id)
      assert.equal(
        mainChildren.filter((c) => c.name === 'Callback: <anonymous>').length,
        1,
        'has segment matching callback'
      )

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
