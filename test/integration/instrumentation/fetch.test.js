/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const test = require('node:test')
const assert = require('node:assert')
const { assertSegments } = require('../../lib/custom-assertions')
const { createServer, createSocketServer } = require('#testlib/undici-mock-server.js')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  const { server, HOST, PORT, REQUEST_URL } = createServer()
  ctx.nr = {
    agent,
    server,
    HOST,
    PORT,
    REQUEST_URL
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

test('should not fail if request not in a transaction', async (t) => {
  const { REQUEST_URL } = t.nr
  const { status } = await fetch(`${REQUEST_URL}/post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application.json'
    },
    body: Buffer.from('{"key":"value"}')
  })

  assert.equal(status, 200)
})

test('should properly name segments', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)

    assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/post`], { exact: false })
    tx.end()
  })
})

test('should add attributes to external segment', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/get?a=b&c=d`)
    assert.equal(status, 200)
    const segment = metrics.findSegment(tx.trace, tx.trace.root, `External/${HOST}/get`)
    const attrs = segment.getAttributes()
    assert.equal(attrs.url, `${REQUEST_URL}/get`)
    assert.equal(attrs.procedure, 'GET')
    const spanAttrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    assert.equal(spanAttrs['http.statusCode'], 200)
    assert.equal(spanAttrs['http.statusText'], 'OK')
    assert.equal(spanAttrs['request.parameters.a'], 'b')
    assert.equal(spanAttrs['request.parameters.c'], 'd')

    tx.end()
  })
})

test('should add proper traceparent to outgoing headers', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const body = await fetch(`${REQUEST_URL}/headers`)
    assert.equal(body.status, 200)
    const segment = metrics.findSegment(tx.trace, tx.trace.root, `External/${HOST}/headers`)
    const { traceparent } = await body.json()
    const [version, traceId, parentSpan, sampledFlag] = traceparent.split('-')
    assert.equal(version, '00')
    assert.equal(traceId, tx.traceId)
    assert.equal(parentSpan, segment.id)
    assert.equal(sampledFlag, '01')
    tx.end()
  })
})

test('should add unscoped metrics for an external request', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/get?a=b&c=d`)
    assert.equal(status, 200)
    tx.end()

    const expectedNames = [
      `External/${HOST}/undici`,
      `External/${HOST}/all`,
      'External/allWeb',
      'External/all'
    ]
    expectedNames.forEach((metricName) => {
      const metric = agent.metrics.getOrCreateMetric(metricName)
      assert.equal(
        metric.callCount,
        1,
        `should record unscoped external metric of ${metricName} for an fetch`
      )
    })
  })
})

test('concurrent requests', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const req1 = fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    const req2 = fetch(`${REQUEST_URL}/put`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    const [{ status }, { status: status2 }] = await Promise.all([req1, req2])
    assert.equal(status, 200)
    assert.equal(status2, 200)
    const postName = `External/${HOST}/post`
    const putName = `External/${HOST}/put`
    const postSegment = metrics.findSegment(tx.trace, tx.trace.root, postName)
    assert.equal(postSegment.parentId, tx.trace.root.id)
    const putSegment = metrics.findSegment(tx.trace, tx.trace.root, putName)
    // parent of put is the post segment because it is still the active one
    // not ideal, but our instrumentation does not play nice with diagnostic_channel
    // we're setting the active segment in the `undici:request:create` and restoring
    // the parent segment in the request end
    assert.equal(putSegment.parentId, postSegment.id)
    assertSegments(tx.trace, tx.trace.root, [postSegment, putSegment], {
      exact: false
    })
    tx.end()
  })
})

test('concurrent requests in diff transaction', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  const tx1 = helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    const postName = `External/${HOST}/post`
    const postSegment = metrics.findSegment(tx.trace, tx.trace.root, postName)
    assert.equal(postSegment.parentId, tx.trace.root.id)
    tx.end()
  })

  const tx2 = helper.runInTransaction(agent, async(tx) => {
    const { status } = await fetch(`${REQUEST_URL}/put`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    const putName = `External/${HOST}/put`
    const putSegment = metrics.findSegment(tx.trace, tx.trace.root, putName)
    assert.equal(putSegment.parentId, tx.trace.root.id)
    tx.end()
  })

  await Promise.all([tx1, tx2])
})

test('invalid host', async (t) => {
  const { agent } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    try {
      await fetch('https://invalidurl/foo', {
        method: 'GET'
      })
    } catch (err) {
      assert.equal(err.message, 'fetch failed')
      assertSegments(tx.trace, tx.trace.root, ['External/invalidurl/foo'], { exact: false })
      assert.equal(tx.exceptions.length, 1)
      tx.end()
    }
  })
})

test('should add errors to transaction when external segment exists', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  const abortController = new AbortController()
  await helper.runInTransaction(agent, async (tx) => {
    try {
      const req = fetch(`${REQUEST_URL}/delay/1000`, {
        signal: abortController.signal
      })
      setTimeout(() => {
        abortController.abort()
      }, 100)
      await req
    } catch (err) {
      assert.match(err.message, /This operation was aborted/)
      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/delay/1000`], { exact: false })
      assert.equal(tx.exceptions.length, 1)
      assert.equal(tx.exceptions[0].error.name, 'AbortError')
      tx.end()
    }
  })
})

test('segments should end on error', async (t) => {
  const socketEndServer = createSocketServer()
  const { agent } = t.nr
  t.after(() => {
    socketEndServer.close()
  })

  await helper.runInTransaction(agent, async (transaction) => {
    const { port } = socketEndServer.address()
    const req = fetch(`http://localhost:${port}`)

    try {
      await req
    } catch (error) {
      assert.match(error.message, /fetch failed/)
      assertSegments(transaction.trace, transaction.trace.root, [`External/localhost:${port}/`], {
        exact: false
      })

      const segments = transaction.trace.getChildren(transaction.trace.root.id)
      const segment = segments[segments.length - 1]

      assert.ok(segment.timer.start, 'should have started')
      assert.ok(segment.timer.hasEnd(), 'should have ended')

      transaction.end()
    }
  })
})

test('400 status', async (t) => {
  const { agent, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/status/400`)
    assert.equal(status, 400)
    assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/status/400`], { exact: false })
    tx.end()
  })
})
