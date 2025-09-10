/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const test = require('node:test')
const symbols = require('../../../lib/symbols')
const nock = require('nock')
const { tspl } = require('@matteo.collina/tspl')
const net = require('net')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')
const fs = require('node:fs/promises')

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

  await t.test('segments should end on error', async function (t) {
    const plan = tspl(t, { plan: 3 })
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

        plan.equal(
          segment.name,
          'External/localhost:' + notVeryReliable.address().port + '/',
          'should be named'
        )
        plan.ok(segment.timer.start, 'should have started')
        plan.ok(segment.timer.hasEnd(), 'should have ended')
      })
    })

    await plan.completed
  })

  await t.test('should have expected child segments', async function (t) {
    const plan = tspl(t, { plan: 7 })
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
      plan.equal(
        external.name,
        'External/localhost:' + server.address().port + '/some/path',
        'should be named as an external'
      )
      plan.ok(external.timer.start, 'should have started')
      plan.ok(external.timer.hasEnd(), 'should have ended')
      const externalChildren = tx.trace.getChildren(external.id)
      plan.ok(externalChildren.length, 'should have children')

      let connect = externalChildren[0]
      plan.equal(connect.name, 'http.Agent#createConnection', 'should be connect segment')
      let connectChildren = tx.trace.getChildren(connect.id)
      plan.equal(connectChildren.length, 1, 'connect should have 1 child')

      // as of Node 24.5.0 there's yet another layer of net segments
      if (connectChildren[0].name === 'net.createConnection') {
        connectChildren = tx.trace.getChildren(connectChildren[0].id)
      }
      // There is potentially an extra layer of create/connect segments.
      if (connectChildren[0].name === 'net.Socket.connect') {
        connect = connectChildren[0]
      }

      connectChildren = tx.trace.getChildren(connect.id)

      const dnsLookup = connectChildren[0]
      plan.equal(dnsLookup.name, 'dns.lookup', 'should be dns.lookup segment')
    }

    await plan.completed
  })

  await t.test('should recognize requests via proxy correctly', async function (t) {
    const plan = tspl(t, { plan: 2 })
    const { agent, http } = t.nr
    const proxyUrl = 'https://www.google.com/proxy/path'
    const proxyServer = http.createServer(function onRequest(req, res) {
      plan.equal(req.url, proxyUrl)
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
          plan.equal(
            segment.name,
            'External/www.google.com/proxy/path',
            'should name segment as an external service'
          )
        })
      })

      req.on('error', function onError(err) {
        plan.fail('Request should not error: ' + err.message)
      })
    })

    await plan.completed
  })

  await t.test('NODE-1647 should not interfere with `got`', { timeout: 5000 }, async function (t) {
    const plan = tspl(t, { plan: 1 })
    const { agent } = t.nr
    // Our way of wrapping HTTP response objects caused `got` to hang. This was
    // resolved in agent 2.5.1.
    nock.disableNetConnect()
    t.after(() => {
      nock.enableNetConnect()
    })
    nock('https://example.com').get('/').reply(200)
    const got = require('got')
    await helper.runInTransaction(agent, async function () {
      const req = got('https://example.com/')
      t.after(function () {
        req.cancel()
      })
      await req
      plan.ok(true)
    })
  })

  await t.test('unix sockets', async function(t) {
    const { agent, http } = t.nr
    const plan = tspl(t, { plan: 2 })
    const socketPath = './test.sock'
    try {
      await fs.unlink(socketPath)
    } catch {
      // this is defensive code in case a socket was dangling
    }
    const server = net.createServer((socket) => {
      socket.on('data', () => {
        socket.end('HTTP/1.1 200 OK\r\n\r\n')
      })
    })

    await new Promise((resolve) => {
      server.listen(socketPath, resolve)
    })
    t.after(() => {
      server.close()
    })

    await helper.runInTransaction(agent, async function () {
      await new Promise((resolve) => {
        http.get({ host: '::1', socketPath }, (res) => {
          const segment = agent.tracer.getSegment()
          plan.equal(segment.name, 'External/::1')
          const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
          plan.deepEqual(attributes, {
            hostname: '::1',
            port: 80,
            url: 'http://::1/',
            procedure: 'GET',
            'http.statusCode': 200,
            'http.statusText': 'OK'
          })
          res.resume()
          resolve()
        })
      })
    })
    await plan.completed
  })

  await t.test('should record requests to default ports', async (t) => {
    const plan = tspl(t, { plan: 1 })
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
          plan.equal(segment.name, 'External/example.com/', 'should create external segment')
        })
      })
    })

    await plan.completed
  })

  await t.test('should expose the external segment on the http request', async (t) => {
    const plan = tspl(t, { plan: 2 })
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
          plan.deepEqual(attrs, {
            url: 'http://example.com/',
            procedure: 'GET'
          })
          plan.equal(reqSegment, segment, 'should expose external')
        })
      })
      reqSegment = req[symbols.segment]
    })

    await plan.completed
  })
})
