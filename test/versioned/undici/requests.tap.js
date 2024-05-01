/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
const http = require('http')
const https = require('https')
const { version: pkgVersion } = require('undici/package')
const semver = require('semver')

tap.test('Undici request tests', (t) => {
  t.autoend()

  let agent
  let undici
  let server
  let REQUEST_URL
  let HOST
  let PORT

  function createServer() {
    server = http.createServer((req, res) => {
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
      } else {
        res.writeHead(200)
        res.end('ok')
      }
    })

    server.listen(0)
    const { port } = server.address()
    PORT = port
    HOST = `localhost:${port}`
    REQUEST_URL = `http://${HOST}`
    return server
  }

  t.before(() => {
    agent = helper.instrumentMockedAgent()

    undici = require('undici')
    server = createServer()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  t.test('should not fail if request not in a transaction', async (t) => {
    const { statusCode } = await undici.request(REQUEST_URL, {
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from(`{"key":"value"}`)
    })

    t.equal(statusCode, 200)
    t.end()
  })

  t.test('should properly name segments', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request(REQUEST_URL, {
        path: '/post',
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      t.equal(statusCode, 200)

      t.assertSegments(tx.trace.root, [`External/${HOST}/post`], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('should add HTTPS port to segment name when provided', async (t) => {
    const [key, cert, ca] = await helper.withSSL()
    const httpsServer = https.createServer({ key, cert }, (req, res) => {
      res.write('SSL response')
      res.end()
    })

    t.teardown(() => {
      httpsServer.close()
    })

    httpsServer.listen(0)

    await helper.runInTransaction(agent, async (transaction) => {
      const { port } = httpsServer.address()

      const client = new undici.Client(`https://localhost:${port}`, {
        tls: {
          ca
        }
      })

      t.teardown(() => {
        client.close()
      })

      await client.request({ path: '/', method: 'GET' })

      t.assertSegments(transaction.trace.root, [`External/localhost:${port}/`], {
        exact: false
      })

      transaction.end()
    })
  })

  t.test('should add attributes to external segment', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request(REQUEST_URL, {
        path: '/get?a=b&c=d',
        method: 'GET'
      })
      t.equal(statusCode, 200)
      const segment = metrics.findSegment(tx.trace.root, `External/${HOST}/get`)
      const attrs = segment.getAttributes()
      t.equal(attrs.url, `${REQUEST_URL}/get`)
      t.equal(attrs.procedure, 'GET')
      const spanAttrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
      t.equal(spanAttrs['http.statusCode'], 200)
      t.equal(spanAttrs['http.statusText'], 'OK')
      t.equal(spanAttrs['request.parameters.a'], 'b')
      t.equal(spanAttrs['request.parameters.c'], 'd')
      t.equal(spanAttrs.hostname, 'localhost')
      t.equal(spanAttrs.port, `${PORT}`)
      tx.end()
      t.end()
    })
  })

  t.test('should add unscoped metrics for an external request', (t) => {
    // make sure metric aggregator is empty before asserting metrics
    agent.metrics.clear()
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request(REQUEST_URL, {
        path: '/get?a=b&c=d',
        method: 'GET'
      })
      t.equal(statusCode, 200)
      tx.end()

      const expectedNames = [
        `External/${HOST}/undici`,
        `External/${HOST}/all`,
        'External/allWeb',
        'External/all'
      ]
      expectedNames.forEach((metricName) => {
        const metric = agent.metrics.getOrCreateMetric(metricName)
        t.equal(
          metric.callCount,
          1,
          `should record unscoped external metric of ${metricName} for an undici request`
        )
      })

      t.end()
    })
  })

  t.test('concurrent requests', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const req1 = undici.request(REQUEST_URL, {
        path: '/post',
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const req2 = undici.request(REQUEST_URL, {
        path: '/put',
        method: 'PUT',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const [{ statusCode }, { statusCode: statusCode2 }] = await Promise.all([req1, req2])
      t.equal(statusCode, 200)
      t.equal(statusCode2, 200)
      t.assertSegments(tx.trace.root, [`External/${HOST}/post`, `External/${HOST}/put`], {
        exact: false
      })
      tx.end()
      t.end()
    })
  })

  t.test('invalid host', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      try {
        await undici.request('https://invalidurl', {
          path: '/foo',
          method: 'GET'
        })
      } catch (err) {
        t.match(err.message, /getaddrinfo.*invalidurl/)
        t.assertSegments(tx.trace.root, ['External/invalidurl/foo'], { exact: false })
        t.equal(tx.exceptions.length, 1)
        tx.end()
        t.end()
      }
    })
  })

  t.test('should add errors to transaction when external segment exists', (t) => {
    const abortController = new AbortController()
    helper.runInTransaction(agent, async (tx) => {
      try {
        const req = undici.request(REQUEST_URL, {
          path: '/delay/1000',
          signal: abortController.signal
        })
        setTimeout(() => {
          abortController.abort()
        }, 100)
        await req
      } catch (err) {
        t.assertSegments(tx.trace.root, [`External/${HOST}/delay/1000`], { exact: false })
        t.equal(tx.exceptions.length, 1)
        const expectedErrMsg = semver.gte(pkgVersion, '6.3.0')
          ? 'This operation was aborted'
          : 'Request aborted'
        t.equal(tx.exceptions[0].error.message, expectedErrMsg)
        tx.end()
        t.end()
      }
    })
  })

  t.test('segments should end on error', (t) => {
    const socketEndServer = http.createServer(function badHandler(req) {
      req.socket.end()
    })

    t.teardown(() => {
      socketEndServer.close()
    })

    socketEndServer.listen(0)

    helper.runInTransaction(agent, async (transaction) => {
      const { port } = socketEndServer.address()
      const req = undici.request(`http://localhost:${port}`)

      try {
        await req
      } catch (error) {
        t.assertSegments(transaction.trace.root, [`External/localhost:${port}/`], {
          exact: false
        })

        const segments = transaction.trace.root.children
        const segment = segments[segments.length - 1]

        t.ok(segment.timer.start, 'should have started')
        t.ok(segment.timer.hasEnd(), 'should have ended')

        transaction.end()

        t.end()
      }
    })
  })

  t.test('400 status', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { statusCode } = await undici.request(REQUEST_URL, {
        path: '/status/400',
        method: 'GET'
      })
      t.equal(statusCode, 400)
      t.assertSegments(tx.trace.root, [`External/${HOST}/status/400`], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('fetch', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const res = await undici.fetch(REQUEST_URL)
      t.equal(res.status, 200)
      t.assertSegments(tx.trace.root, [`External/${HOST}/`], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('stream', (t) => {
    const { Writable } = require('stream')
    helper.runInTransaction(agent, async (tx) => {
      await undici.stream(
        REQUEST_URL,
        {
          path: '/get'
        },
        ({ statusCode }) => {
          t.equal(statusCode, 200)
          return new Writable({
            write(chunk, encoding, callback) {
              callback()
            }
          })
        }
      )
      t.assertSegments(tx.trace.root, [`External/${HOST}/get`], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('pipeline', (t) => {
    const { pipeline, PassThrough, Readable, Writable } = require('stream')
    helper.runInTransaction(agent, async (tx) => {
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
            t.equal(statusCode, 200)
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
          t.error(err)
          t.assertSegments(tx.trace.root, [`External/${HOST}/get`], { exact: false })
          tx.end()
          t.end()
        }
      )
    })
  })
})
