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
const http = require('http')
const https = require('https')
const { version: pkgVersion } = require('undici/package')
const semver = require('semver')

const fakeCert = require('../../lib/fake-cert')
const cert = fakeCert({ commonName: 'localhost' })

function createServer() {
  const server = http.createServer((req, res) => {
    if (req.url.includes('/delay')) {
      const parts = req.url.split('/')
      const delayInMs = parts[parts.length - 1]
      setTimeout(() => {
        res.writeHead(200)
        res.end('ok')
      }, delayInMs)
    } else if (req.url.includes('/status')) {
      const parts = req.url.split('/')
      const statusCode = parts[parts.length - 1]
      res.writeHead(statusCode)
      res.end()
    } else if (req.url.includes('/headers')) {
      const data = JSON.stringify(req.headers)
      res.writeHead(200, {
        'Content-Length': data.length,
        'Content-Type': 'application/json'
      })
      res.end(data)
    } else {
      res.writeHead(200)
      res.end('ok')
    }
  })

  server.listen(0)
  const { port } = server.address()
  const PORT = port
  const HOST = `localhost:${port}`
  const REQUEST_URL = `http://${HOST}`
  return { server, PORT, HOST, REQUEST_URL }
}

test('Undici request tests', async (t) => {
  const agent = helper.instrumentMockedAgent()
  const undici = require('undici')
  const { server, HOST, PORT, REQUEST_URL } = createServer()

  t.after(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  await t.test('should not fail if request not in a transaction', async () => {
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

  await t.test('should properly name segments', async () => {
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

  await t.test('should add HTTPS port to segment name when provided', async () => {
    const httpsServer = https.createServer(
      { key: cert.privateKey, cert: cert.certificate },
      (req, res) => {
        res.write('SSL response')
        res.end()
      }
    )

    t.after(() => {
      httpsServer.close()
    })

    httpsServer.listen(0)

    await helper.runInTransaction(agent, async (transaction) => {
      const { port } = httpsServer.address()

      const client = new undici.Client(`https://localhost:${port}`, {
        tls: { ca: cert.certificate }
      })

      t.after(() => {
        client.close()
      })

      await client.request({ path: '/', method: 'GET' })

      assertSegments(transaction.trace, transaction.trace.root, [`External/localhost:${port}/`], {
        exact: false
      })

      transaction.end()
    })
  })

  await t.test('should add attributes to external segment', async () => {
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

  await t.test('should add proper traceparent to outgoing headers', async () => {
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

  await t.test('should add unscoped metrics for an external request', async () => {
    // make sure metric aggregator is empty before asserting metrics
    agent.metrics.clear()
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

  await t.test('concurrent requests', async () => {
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

  await t.test('concurrent requests in diff transaction', async () => {
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

  await t.test('invalid host', async () => {
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

  await t.test('should add errors to transaction when external segment exists', async () => {
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

  await t.test('should not log error when `feature_flag.undici_error_tracking` is false', async (t) => {
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

  await t.test('segments should end on error', async () => {
    const socketEndServer = http.createServer(function badHandler(req) {
      req.socket.end()
    })

    t.after(() => {
      socketEndServer.close()
    })

    socketEndServer.listen(0)

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

  await t.test('400 status', async () => {
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

  await t.test('fetch', async () => {
    await helper.runInTransaction(agent, async (tx) => {
      const res = await undici.fetch(REQUEST_URL)
      assert.equal(res.status, 200)
      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/`], { exact: false })
      tx.end()
    })
  })

  await t.test('stream', async () => {
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

  await t.test('pipeline', (_t, end) => {
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
})
