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
const http = require('http')
const { assertSegments } = require('../../lib/custom-assertions')

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
      const status = parts[parts.length - 1]
      res.writeHead(status)
      res.end()
    } else {
      res.writeHead(200)
      res.end('ok')
    }
  })

  server.listen(0)
  const { port } = server.address()
  const HOST = `localhost:${port}`
  const REQUEST_URL = `http://${HOST}`
  return { server, HOST, REQUEST_URL }
}

// fetch instrumentation is done via undici
// undici instrumentation is done via diagnostics channel
// we cannot re-register between every test
test('fetch', async function (t) {
  const agent = helper.instrumentMockedAgent()
  const { server, HOST, REQUEST_URL } = createServer()

  t.afterEach(() => {
    agent.metrics.clear()
  })

  t.after(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  await t.test('should not fail if request not in a transaction', async () => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from(`{"key":"value"}`)
    })

    assert.equal(status, 200)
  })

  await t.test('should properly name segments', async () => {
    await helper.runInTransaction(agent, async (tx) => {
      const { status } = await fetch(`${REQUEST_URL}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      assert.equal(status, 200)

      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/post`], { exact: false })
      tx.end()
    })
  })

  await t.test('should add attributes to external segment', async () => {
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

  await t.test('should add unscoped metrics for an external request', async () => {
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

  await t.test('concurrent requests', async () => {
    await helper.runInTransaction(agent, async (tx) => {
      const req1 = fetch(`${REQUEST_URL}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const req2 = fetch(`${REQUEST_URL}/put`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      const [{ status }, { status: status2 }] = await Promise.all([req1, req2])
      assert.equal(status, 200)
      assert.equal(status2, 200)
      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/post`, `External/${HOST}/put`], {
        exact: false
      })
      tx.end()
    })
  })

  await t.test('invalid host', async () => {
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

  await t.test('should add errors to transaction when external segment exists', async () => {
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
        assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/delay/1000`], { exact: false })
        assert.equal(tx.exceptions.length, 1)
        assert.equal(tx.exceptions[0].error.name, 'AbortError')
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
      const req = fetch(`http://localhost:${port}`)

      try {
        await req
      } catch (error) {
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
      const { status } = await fetch(`${REQUEST_URL}/status/400`)
      assert.equal(status, 400)
      assertSegments(tx.trace, tx.trace.root, [`External/${HOST}/status/400`], { exact: false })
      tx.end()
    })
  })
})
