/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { assertSegments, assertSpanKind } = require('../../lib/custom-assertions')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
const { version: pkgVersion } = require('undici/package')
const semver = require('semver')
const { createServer, createHttpsServer, createSocketServer } = require('../../lib/undici-mock-server')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  const undici = require('undici')
  const { server, HOST, PORT, REQUEST_URL } = createServer()
  ctx.nr = {
    agent,
    server,
    undici,
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
  const { undici, REQUEST_URL } = t.nr
  const { statusCode } = await undici.request(REQUEST_URL, {
    path: '/post',
    method: 'POST',
    headers: {
      'Content-Type': 'application.json'
    },
    body: Buffer.from('{"key":"value"}')
  })

  assert.equal(statusCode, 200)
})

test('should properly name segments', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(statusCode, 200)

    const name = `External/${HOST}/post`
    assertSegments(tx.trace, tx.trace.root, [name], { exact: false })
    tx.end()
    assertSpanKind({ agent, segments: [{ name, kind: 'client' }] })
  })
})

test('should add HTTPS port to segment name when provided', async (t) => {
  const { agent, undici } = t.nr
  const { httpsServer, cert } = createHttpsServer()
  const { port } = httpsServer.address()
  const client = new undici.Client(`https://localhost:${port}`, {
    tls: { ca: cert.certificate }
  })
  t.after(() => {
    httpsServer.close()
    client.close()
  })

  await helper.runInTransaction(agent, async (transaction) => {
    await client.request({ path: '/', method: 'GET' })

    assertSegments(transaction.trace, transaction.trace.root, [`External/localhost:${port}/`], {
      exact: false
    })

    transaction.end()
  })
})

test('should add attributes to external segment', async (t) => {
  const { agent, undici, HOST, PORT, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/get?a=b&c=d',
      method: 'GET'
    })
    assert.equal(statusCode, 200)
    const segment = metrics.findSegment(tx.trace, tx.trace.root, `External/${HOST}/get`)
    const attrs = segment.getAttributes()
    assert.equal(attrs.url, `${REQUEST_URL}/get`)
    assert.equal(attrs.procedure, 'GET')
    const spanAttrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    assert.equal(spanAttrs['http.statusCode'], 200)
    assert.equal(spanAttrs['http.statusText'], 'OK')
    assert.equal(spanAttrs['request.parameters.a'], 'b')
    assert.equal(spanAttrs['request.parameters.c'], 'd')
    assert.equal(spanAttrs.hostname, 'localhost')
    assert.equal(spanAttrs.port, `${PORT}`)
    tx.end()
  })
})

test('should add proper traceparent to outgoing headers', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { statusCode, body } = await undici.request(REQUEST_URL, {
      path: '/headers',
      method: 'GET'
    })
    assert.equal(statusCode, 200)
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
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/get?a=b&c=d',
      method: 'GET'
    })
    assert.equal(statusCode, 200)
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
        `should record unscoped external metric of ${metricName} for an undici request`
      )
    })
  })
})

test('concurrent requests', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const req1 = undici.request(REQUEST_URL, {
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    const req2 = undici.request(REQUEST_URL, {
      path: '/put',
      method: 'PUT',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    const [{ statusCode }, { statusCode: statusCode2 }] = await Promise.all([req1, req2])
    assert.equal(statusCode, 200)
    assert.equal(statusCode2, 200)
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
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  const tx1 = helper.runInTransaction(agent, async (tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(statusCode, 200)
    const postName = `External/${HOST}/post`
    const postSegment = metrics.findSegment(tx.trace, tx.trace.root, postName)
    assert.equal(postSegment.parentId, tx.trace.root.id)
    tx.end()
  })

  const tx2 = helper.runInTransaction(agent, async(tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/put',
      method: 'PUT',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(statusCode, 200)
    const putName = `External/${HOST}/put`
    const putSegment = metrics.findSegment(tx.trace, tx.trace.root, putName)
    assert.equal(putSegment.parentId, tx.trace.root.id)
    tx.end()
  })

  await Promise.all([tx1, tx2])
})

test('invalid host', async (t) => {
  const { agent, undici } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    try {
      await undici.request('https://invalidurl', {
        path: '/foo',
        method: 'GET'
      })
    } catch (err) {
      assert.ok(err)
      assertSegments(tx.trace, tx.trace.root, ['External/invalidurl/foo'], { exact: false })
      assert.equal(tx.exceptions.length, 1)
      tx.end()
    }
  })
})

test('should add errors to transaction when external segment exists', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  const abortController = new AbortController()
  await helper.runInTransaction(agent, async (tx) => {
    try {
      const req = undici.request(REQUEST_URL, {
        path: '/delay/1000',
        signal: abortController.signal
      })
      setTimeout(() => {
        abortController.abort()
      }, 100)
      await req
    } catch {
      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/delay/1000`], { exact: false })
      assert.equal(tx.exceptions.length, 1)
      const expectedErrMsg = semver.gte(pkgVersion, '6.3.0')
        ? 'This operation was aborted'
        : 'Request aborted'
      assert.equal(tx.exceptions[0].error.message, expectedErrMsg)
      tx.end()
    }
  })
})

test('should not log error when `feature_flag.undici_error_tracking` is false', async (t) => {
  const { agent, undici } = t.nr
  agent.config.feature_flag.undici_error_tracking = false
  t.after(() => {
    agent.config.feature_flag.undici_error_tracking = true
  })
  await helper.runInTransaction(agent, async (tx) => {
    try {
      await undici.request('https://invalidurl', {
        path: '/foo',
        method: 'GET'
      })
    } catch (err) {
      assert.ok(err)
      assertSegments(tx.trace, tx.trace.root, ['External/invalidurl/foo'], { exact: false })
      assert.equal(tx.exceptions.length, 0)
      tx.end()
    }
  })
})

test('segments should end on error', async (t) => {
  const socketEndServer = createSocketServer()
  const { agent, undici } = t.nr

  t.after(() => {
    socketEndServer.close()
  })

  await helper.runInTransaction(agent, async (transaction) => {
    const { port } = socketEndServer.address()
    const req = undici.request(`http://localhost:${port}`)

    try {
      await req
    } catch {
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
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/status/400',
      method: 'GET'
    })
    assert.equal(statusCode, 400)
    assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/status/400`], { exact: false })
    tx.end()
  })
})

test('fetch', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  await helper.runInTransaction(agent, async (tx) => {
    const res = await undici.fetch(REQUEST_URL)
    assert.equal(res.status, 200)
    assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/`], { exact: false })
    tx.end()
  })
})

test('stream', async (t) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  const { Writable } = require('stream')
  await helper.runInTransaction(agent, async (tx) => {
    await undici.stream(
      REQUEST_URL,
      {
        path: '/get'
      },
      ({ statusCode }) => {
        assert.equal(statusCode, 200)
        return new Writable({
          write(chunk, encoding, callback) {
            callback()
          }
        })
      }
    )
    assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/get`], { exact: false })
    tx.end()
  })
})

test('pipeline', (t, end) => {
  const { agent, undici, HOST, REQUEST_URL } = t.nr
  const { pipeline, PassThrough, Readable, Writable } = require('stream')
  helper.runInTransaction(agent, (tx) => {
    pipeline(
      new Readable({
        read() {
          this.push(Buffer.from('undici'))
          this.push(null)
        }
      }),
      undici.pipeline(
        REQUEST_URL,
        {
          path: '/get'
        },
        ({ statusCode, body }) => {
          assert.equal(statusCode, 200)
          return pipeline(body, new PassThrough(), () => {})
        }
      ),
      new Writable({
        write(chunk, _, callback) {
          callback()
        },
        final(callback) {
          callback()
        }
      }),
      (err) => {
        assert.ok(!err)
        assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/get`], { exact: false })
        tx.end()
        end()
      }
    )
  })
})
