/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Reproduction for https://github.com/newrelic/node-newrelic/issues/4250
//
// When undici negotiates HTTP/2 via ALPN, a single request produces
// two sibling external segments for the same URL: one attributed to `undici`
// (created by the undici diagnostics-channel subscriber) and one attributed to
// `http2` (created by the core http2 instrumentation, because undici internally
// drives http2.connect()/session.request()). Only one request is sent, so this
// inflates external call counts and aggregate external duration.

const test = require('node:test')
const assert = require('node:assert')
const http2 = require('node:http2')
const helper = require('../../lib/agent_helper')
const fakeCert = require('../../lib/fake-cert')

const cert = fakeCert({ commonName: 'localhost' })

/**
 * Creates a secure HTTP/2 server that negotiates `h2` via ALPN.
 *
 * @returns {Promise<object>} the listening server and its origin
 */
function createHttp2Server() {
  const server = http2.createSecureServer({
    key: cert.privateKey,
    cert: cert.certificate,
    allowHTTP1: true
  })

  server.on('stream', (stream) => {
    stream.respond({ ':status': 200, 'content-type': 'text/plain' })
    stream.end('hello over ' + stream.session.alpnProtocol)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, origin: `https://127.0.0.1:${port}`, port })
    })
  })
}

/**
 * Recursively collects all external segments from a trace.
 *
 * @param {Transaction} tx active transaction
 * @param {TraceSegment} segment segment to start from
 * @param {Array} out accumulator
 * @returns {Array} external segments
 */
function collectExternals(tx, segment, out = []) {
  if (segment.name?.startsWith('External/')) {
    out.push(segment)
  }
  for (const child of tx.trace.getChildren(segment.id)) {
    collectExternals(tx, child, out)
  }
  return out
}

test.beforeEach(async (ctx) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: { enabled: true }
  })
  const undici = require('undici')
  const { server, origin, port } = await createHttp2Server()
  ctx.nr = { agent, undici, server, origin, port }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

// The double-instrumentation bug is triggered by HTTP/2 negotiation, not by any
// particular undici major version. `allowH2` is explicitly enabled here so that
// h2 is negotiated on every supported undici major (>= 5), which keeps this test
// deterministic across the versioned matrix. undici 8 flipped the `allowH2`
// default to true, which is what surfaced this bug for users on an upgrade.
test('undici HTTP/2 request should create exactly one external segment', async (t) => {
  const { agent, undici, origin, port } = t.nr
  const dispatcher = new undici.Agent({
    connect: { rejectUnauthorized: false },
    allowH2: true
  })

  await helper.runInTransaction(agent, async (tx) => {
    const res = await undici.request(origin + '/foo', { dispatcher })
    const body = await res.body.text()
    // sanity check that HTTP/2 was actually negotiated
    assert.equal(body, 'hello over h2', 'server should have negotiated h2 via ALPN')
    tx.end()

    const externals = collectExternals(tx, tx.trace.root)
    assert.equal(
      externals.length,
      1,
      `expected exactly one external segment, got ${externals.length}: ` +
        externals.map((e) => e.name).join(', ')
    )

    // the single external should be attributed to undici, not http2
    const unscoped = agent.metrics._metrics.unscoped
    assert.ok(
      unscoped[`External/127.0.0.1:${port}/undici`],
      'external metric should be attributed to undici'
    )
    assert.ok(
      !unscoped[`External/127.0.0.1:${port}/http2`],
      'external metric should NOT be attributed to http2'
    )
    assert.equal(
      unscoped[`External/127.0.0.1:${port}/all`].callCount,
      1,
      'External/<host>/all should count a single call'
    )
    assert.equal(unscoped['External/all'].callCount, 1, 'External/all should count a single call')
  })

  await dispatcher.close()
})
