/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const http = require('node:http')
const https = require('node:https')
const nock = require('nock')

const helper = require('#testlib/agent_helper.js')
const NAMES = require('#agentlib/metrics/names.js')

const HOSTNAME = 'localhost'
const PORT = 8890

/**
 * Issues a request with `http.request` and immediately destroys it. These tests
 * only assert on the connection segment, which is complete once `request()`
 * returns, so the request never needs to reach a server (nothing listens on
 * `PORT`).
 *
 * @param {object} opts The HTTP request options.
 * @returns {http.ClientRequest} The destroyed request.
 */
function makeRequest(opts) {
  const req = http.request(opts)
  // handled so the destroyed request's error isn't thrown
  req.on('error', () => {})
  req.destroy()
  return req
}

/**
 * Gets the external segments directly under the transaction's root segment.
 *
 * @param {Transaction} transaction The transaction to inspect.
 * @returns {TraceSegment[]} The external segments.
 */
function getExternalSegments(transaction) {
  return transaction.trace
    .getChildren(transaction.trace.root.id)
    .filter((segment) => segment.name.startsWith(NAMES.EXTERNAL.PREFIX))
}

test('HttpAgentSubscriber', async (t) => {
  // nock replaces `http.ClientRequest` and its agent, so use the real ones;
  // requests are destroyed before they connect
  t.before(() => {
    nock.restore()
  })

  t.after(() => {
    nock.activate()
  })

  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  const connectionModules = [
    ['http', http],
    ['https', https]
  ]
  for (const [name, mod] of connectionModules) {
    await t.test(`should record the ${name} connection under the external segment`, (t, end) => {
      helper.runInTransaction(t.nr.agent, function (transaction) {
        const req = mod.request({ host: HOSTNAME, port: PORT, path: '/newrelic' })
        req.on('error', () => {})

        const [external] = getExternalSegments(transaction)
        const [connection] = transaction.trace.getChildren(external.id)
        assert.equal(connection.name, 'http.Agent#createConnection')
        assert.ok(connection.timer.hrDuration, 'should touch the segment once the connection is created')
        req.destroy()
        end()
      })
    })
  }

  await t.test('should not record the connection when the parent segment is opaque', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, function (transaction) {
      const parent = agent.tracer.createSegment({ name: 'opaque', parent: transaction.trace.root, transaction })
      parent.opaque = true
      agent.tracer.setSegment({ transaction, segment: parent })

      makeRequest({ host: HOSTNAME, port: PORT, path: '/newrelic' })

      assert.equal(transaction.trace.getChildren(parent.id).length, 0, 'should not add segments to the opaque parent')
      end()
    })
  })

  await t.test('should not record https connections when https instrumentation is disabled', (t, end) => {
    helper.unloadAgent(t.nr.agent)
    t.nr.agent = helper.instrumentMockedAgent({ instrumentation: { https: { enabled: false } } })
    helper.runInTransaction(t.nr.agent, function (transaction) {
      const req = https.request({ host: HOSTNAME, port: PORT, path: '/newrelic' })
      req.on('error', () => {})

      // `net` is still instrumented, so only check for this subscriber's segments
      const names = transaction.trace.getChildren(transaction.trace.root.id).map((segment) => segment.name)
      assert.ok(!names.some((name) => name.startsWith(NAMES.EXTERNAL.PREFIX)), 'should not record an external')
      assert.ok(!names.includes('http.Agent#createConnection'), 'should not record the connection')
      req.destroy()
      end()
    })
  })
})
