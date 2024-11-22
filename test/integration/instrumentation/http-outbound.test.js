/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')
const symbols = require('../../../lib/symbols')

test('external requests', async function (t) {
  t.beforeEach((ctx) => {
    const agent = helper.instrumentMockedAgent()
    const http = require('http')
    ctx.nr = {
      agent,
      http
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('segments should end on error', function (t, end) {
    const { agent, http } = t.nr
    const notVeryReliable = http.createServer(function badHandler(req) {
      req.socket.end()
    })

    t.after(() => {
      notVeryReliable.close()
    })

    notVeryReliable.listen(0)

    helper.runInTransaction(agent, function inTransaction() {
      const req = http.get(notVeryReliable.address())

      req.on('error', function onError() {
        const segment = agent.tracer.getTransaction().trace.root.children[0]

        assert.equal(
          segment.name,
          'External/localhost:' + notVeryReliable.address().port + '/',
          'should be named'
        )
        assert.ok(segment.timer.start, 'should have started')
        assert.ok(segment.timer.hasEnd(), 'should have ended')
        end()
      })
    })
  })

  await t.test('should have expected child segments', function (t, end) {
    const { agent, http } = t.nr
    // The externals segment is based on the lifetime of the request and response.
    // These objects are event emitters and we consider the external to be
    // completed when the response emits `end`. Since there are actions that
    // happen throughout the requests lifetime on other events, each of those
    // sequences will be their own tree under the main external call. This
    // results in a tree with several sibling branches that might otherwise be
    // shown in a hierarchy. This is okay.
    const server = http.createServer(function (req, res) {
      req.resume()
      res.end('ok')
    })
    t.after(function () {
      server.close()
    })

    server.listen(0)

    helper.runInTransaction(agent, function inTransaction(tx) {
      const url = 'http://localhost:' + server.address().port + '/some/path'
      http.get(url, function onResponse(res) {
        res.resume()
        res.once('end', function resEnded() {
          setTimeout(function timeout() {
            check(tx)
          }, 10)
        })
      })
    })

    function check(tx) {
      const external = tx.trace.root.children[0]
      assert.equal(
        external.name,
        'External/localhost:' + server.address().port + '/some/path',
        'should be named as an external'
      )
      assert.ok(external.timer.start, 'should have started')
      assert.ok(external.timer.hasEnd(), 'should have ended')
      assert.ok(external.children.length, 'should have children')

      let connect = external.children[0]
      assert.equal(connect.name, 'http.Agent#createConnection', 'should be connect segment')
      assert.equal(connect.children.length, 1, 'connect should have 1 child')

      // There is potentially an extra layer of create/connect segments.
      if (connect.children[0].name === 'net.Socket.connect') {
        connect = connect.children[0]
      }

      const dnsLookup = connect.children[0]
      assert.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')

      const callback = external.children[external.children.length - 1]
      assert.equal(callback.name, 'timers.setTimeout', 'should have timeout segment')

      end()
    }
  })

  await t.test('should recognize requests via proxy correctly', function (t, end) {
    const { agent, http } = t.nr
    const proxyUrl = 'https://www.google.com/proxy/path'
    const proxyServer = http.createServer(function onRequest(req, res) {
      assert.equal(req.url, proxyUrl)
      req.resume()
      res.end('ok')
    })
    t.after(() => proxyServer.close())

    proxyServer.listen(0)

    helper.runInTransaction(agent, function inTransaction() {
      const opts = {
        host: 'localhost',
        port: proxyServer.address().port,
        path: proxyUrl,
        protocol: 'http:'
      }

      const req = http.get(opts, function onResponse(res) {
        res.resume()
        res.once('end', function () {
          const segment = agent.tracer.getTransaction().trace.root.children[0]
          assert.equal(
            segment.name,
            `External/www.google.com/proxy/path`,
            'should name segment as an external service'
          )
          end()
        })
      })

      req.on('error', function onError(err) {
        assert.fail('Request should not error: ' + err.message)
        end()
      })
    })
  })

  await t.test('should not duplicate the external segment', function (t, end) {
    const { agent } = t.nr
    const https = require('https')

    helper.runInTransaction(agent, function inTransaction() {
      https.get('https://example.com:443/', function onResponse(res) {
        res.once('end', check)
        res.resume()
      })
    })

    function check() {
      const root = agent.tracer.getTransaction().trace.root
      const segment = root.children[0]

      assert.equal(segment.name, 'External/example.com/', 'should be named')
      assert.ok(segment.timer.start, 'should have started')
      assert.ok(segment.timer.hasEnd(), 'should have ended')
      assert.equal(segment.children.length, 1, 'should have 1 child')

      const notDuped = segment.children[0]
      assert.notEqual(
        notDuped.name,
        segment.name,
        'child should not be named the same as the external segment'
      )

      end()
    }
  })

  await t.test('NODE-1647 should not interfere with `got`', { timeout: 5000 }, function (t, end) {
    const { agent } = t.nr
    // Our way of wrapping HTTP response objects caused `got` to hang. This was
    // resolved in agent 2.5.1.
    const got = require('got')
    helper.runInTransaction(agent, function () {
      const req = got('https://example.com/')
      t.after(function () {
        req.cancel()
      })
      req.then(
        function () {
          end()
        },
        function (e) {
          assert.ok(!e)
          end()
        }
      )
    })
  })

  await t.test('should record requests to default ports', (t, end) => {
    const { agent, http } = t.nr
    helper.runInTransaction(agent, (tx) => {
      http.get('http://example.com', (res) => {
        res.resume()
        res.on('end', () => {
          const segment = tx.trace.root.children[0]
          assert.equal(segment.name, 'External/example.com/', 'should create external segment')
          end()
        })
      })
    })
  })

  await t.test('should expose the external segment on the http request', (t, end) => {
    const { agent, http } = t.nr
    helper.runInTransaction(agent, (tx) => {
      let reqSegment = null
      const req = http.get('http://example.com', (res) => {
        res.resume()
        res.on('end', () => {
          const segment = tx.trace.root.children[0]
          const attrs = segment.getAttributes()
          assert.deepEqual(attrs, {
            url: 'http://example.com/',
            procedure: 'GET'
          })
          assert.equal(reqSegment, segment, 'should expose external')
          end()
        })
      })
      reqSegment = req[symbols.segment]
    })
  })
})
