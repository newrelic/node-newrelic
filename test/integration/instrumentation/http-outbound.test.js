/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')
const symbols = require('../../../lib/symbols')
const nock = require('nock')

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

    helper.runInTransaction(agent, function inTransaction(tx) {
      const req = http.get(notVeryReliable.address())

      req.on('error', function onError() {
        const [segment] = tx.trace.getChildren(tx.trace.root.id)

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
      const [external] = tx.trace.getChildren(tx.trace.root.id)
      assert.equal(
        external.name,
        'External/localhost:' + server.address().port + '/some/path',
        'should be named as an external'
      )
      assert.ok(external.timer.start, 'should have started')
      assert.ok(external.timer.hasEnd(), 'should have ended')
      const externalChildren = tx.trace.getChildren(external.id)
      assert.ok(externalChildren.length, 'should have children')

      let connect = externalChildren[0]
      assert.equal(connect.name, 'http.Agent#createConnection', 'should be connect segment')
      let connectChildren = tx.trace.getChildren(connect.id)
      assert.equal(connectChildren.length, 1, 'connect should have 1 child')

      // There is potentially an extra layer of create/connect segments.
      if (connectChildren[0].name === 'net.Socket.connect') {
        connect = connectChildren[0]
      }
      connectChildren = tx.trace.getChildren(connect.id)

      const dnsLookup = connectChildren[0]
      assert.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')

      const callback = externalChildren[externalChildren.length - 1]
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
          const { trace } = agent.tracer.getTransaction()
          const [segment] = trace.getChildren(trace.root.id)
          assert.equal(
            segment.name,
            'External/www.google.com/proxy/path',
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

  await t.test('NODE-1647 should not interfere with `got`', { timeout: 5000 }, function (t, end) {
    const { agent } = t.nr
    // Our way of wrapping HTTP response objects caused `got` to hang. This was
    // resolved in agent 2.5.1.
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('https://example.com').get('/').reply(200)
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
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('http://example.com').get('/').reply(200)
    helper.runInTransaction(agent, (tx) => {
      http.get('http://example.com/', (res) => {
        res.resume()
        res.on('end', () => {
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
          assert.equal(segment.name, 'External/example.com/', 'should create external segment')
          end()
        })
      })
    })
  })

  await t.test('should expose the external segment on the http request', (t, end) => {
    const { agent, http } = t.nr
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('http://example.com').get('/').reply(200)
    helper.runInTransaction(agent, (tx) => {
      let reqSegment = null
      const req = http.get('http://example.com/', (res) => {
        res.resume()
        res.on('end', () => {
          const [segment] = tx.trace.getChildren(tx.trace.root.id)
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
