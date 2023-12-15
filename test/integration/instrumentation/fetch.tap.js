/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const metrics = require('../../lib/metrics_helper')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const tap = require('tap')
const http = require('http')
const semver = require('semver')

tap.test('fetch', { skip: semver.lte(process.version, '18.0.0') }, function (t) {
  t.autoend()
  let agent
  let server
  let REQUEST_URL
  let HOST

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
    HOST = `localhost:${port}`
    REQUEST_URL = `http://${HOST}`
    return server
  }

  t.before(() => {
    agent = helper.instrumentMockedAgent()

    server = createServer()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  t.test('should not fail if request not in a transaction', async (t) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from(`{"key":"value"}`)
    })

    t.equal(status, 200)
    t.end()
  })

  t.test('should properly name segments', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { status } = await fetch(`${REQUEST_URL}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application.json'
        },
        body: Buffer.from(`{"key":"value"}`)
      })
      t.equal(status, 200)

      t.assertSegments(tx.trace.root, [`External/${HOST}/post`], { exact: false })
      tx.end()
      t.end()
    })
  })

  t.test('should add attributes to external segment', (t) => {
    helper.runInTransaction(agent, async (tx) => {
      const { status } = await fetch(`${REQUEST_URL}/get?a=b&c=d`)
      t.equal(status, 200)
      const segment = metrics.findSegment(tx.trace.root, `External/${HOST}/get`)
      const attrs = segment.getAttributes()
      t.equal(attrs.url, `${REQUEST_URL}/get`)
      t.equal(attrs.procedure, 'GET')
      const spanAttrs = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
      t.equal(spanAttrs['http.statusCode'], 200)
      t.equal(spanAttrs['http.statusText'], 'OK')
      t.equal(spanAttrs['request.parameters.a'], 'b')
      t.equal(spanAttrs['request.parameters.c'], 'd')

      tx.end()
      t.end()
    })
  })

  t.test('should add unscoped metrics for an external request', (t) => {
    // make sure metric aggregator is empty before asserting metrics
    agent.metrics.clear()
    helper.runInTransaction(agent, async (tx) => {
      const { status } = await fetch(`${REQUEST_URL}/get?a=b&c=d`)
      t.equal(status, 200)
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
          `should record unscoped external metric of ${metricName} for an fetch`
        )
      })

      t.end()
    })
  })

  t.test('concurrent requests', (t) => {
    helper.runInTransaction(agent, async (tx) => {
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
      t.equal(status, 200)
      t.equal(status2, 200)
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
        await fetch('https://invalidurl/foo', {
          method: 'GET'
        })
      } catch (err) {
        t.equal(err.message, 'fetch failed')
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
        const req = fetch(`${REQUEST_URL}/delay/1000`, {
          signal: abortController.signal
        })
        setTimeout(() => {
          abortController.abort()
        }, 100)
        await req
      } catch (err) {
        t.assertSegments(tx.trace.root, [`External/${HOST}/delay/1000`], { exact: false })
        t.equal(tx.exceptions.length, 1)
        t.equal(tx.exceptions[0].error.name, 'AbortError')
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
      const req = fetch(`http://localhost:${port}`)

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
      const { status } = await fetch(`${REQUEST_URL}/status/400`)
      t.equal(status, 400)
      t.assertSegments(tx.trace.root, [`External/${HOST}/status/400`], { exact: false })
      tx.end()
      t.end()
    })
  })
})
