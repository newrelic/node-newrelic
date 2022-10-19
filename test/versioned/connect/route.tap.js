/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const helper = require('../../lib/agent_helper')
const semver = require('semver')

// connect is a loudmouth without this
process.env.NODE_ENV = 'test'

test('transaction tests', function (t) {
  t.autoend()
  let agent

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
  })

  t.test('should properly name transaction from route name', function (t) {
    t.plan(10)
    const connect = require('connect')
    const { version: pkgVersion } = require('connect/package')
    let server = null
    agent.once('transactionFinished', function (transaction) {
      t.equal(transaction.name, 'WebTransaction/Connect/GET//foo')
      t.equal(transaction.url, '/foo', 'URL is left alone')
      t.equal(transaction.verb, 'GET', 'HTTP method is GET')
      t.equal(transaction.statusCode, 200, 'status code is OK')
      t.ok(transaction.trace, 'transaction has trace')
      const web = transaction.trace.root.children[0]
      t.ok(web, 'trace has web segment')
      t.equal(web.name, transaction.name, 'segment name and transaction name match')
      t.equal(web.partialName, 'Connect/GET//foo', 'should have partial name for apdex')

      server.close()
    })

    const app = connect()

    function middleware(req, res) {
      t.ok(agent.getTransaction(), 'transaction should be available')
      res.end('foo')
    }

    app.use('/foo', middleware)
    server = createServerAndMakeRequest({ url: '/foo', expectedData: 'foo', t, app, pkgVersion })
  })

  t.test('should default to `/` when no route is specified', function (t) {
    t.plan(10)
    const connect = require('connect')
    const { version: pkgVersion } = require('connect/package')
    let server = null
    agent.once('transactionFinished', function (transaction) {
      t.equal(transaction.name, 'WebTransaction/Connect/GET//')
      t.equal(transaction.url, '/foo', 'URL is left alone')
      t.equal(transaction.verb, 'GET', 'HTTP method is GET')
      t.equal(transaction.statusCode, 200, 'status code is OK')
      t.ok(transaction.trace, 'transaction has trace')
      const web = transaction.trace.root.children[0]
      t.ok(web, 'trace has web segment')
      t.equal(web.name, transaction.name, 'segment name and transaction name match')
      t.equal(web.partialName, 'Connect/GET//', 'should have partial name for apdex')

      server.close()
    })

    const app = connect()

    function middleware(req, res) {
      t.ok(agent.getTransaction(), 'transaction should be available')
      res.end('root')
    }

    app.use(middleware)
    server = createServerAndMakeRequest({ url: '/foo', expectedData: 'root', t, app, pkgVersion })
  })
})

/**
 * Sets up HTTP server and binds a connect instance
 * It then makes a request to specified url and asserts the response
 * data is correct
 *
 * @param {Object} params
 * @param {string} params.url url to make request
 * @param {string} params.expectedData expected response data
 * @param {tap.Test} t
 * @param {Object} app connect app
 * @return {http.Server}
 */
function createServerAndMakeRequest({ url, expectedData, t, app, pkgVersion }) {
  const http = require('http')
  let requestListener = app

  // connect < v2 was a different module
  // you had to manually call app.handle
  if (semver.satisfies(pkgVersion, '<2')) {
    requestListener = function (req, res) {
      app.handle(req, res)
    }
  }

  const server = http.createServer(requestListener).listen(0, function () {
    const req = http.request(
      {
        port: server.address().port,
        host: 'localhost',
        path: url,
        method: 'GET'
      },
      function onResponse(res) {
        res.on('data', function (data) {
          t.equal(data.toString(), expectedData, 'should respond with proper data')
        })
      }
    )
    req.end()
  })
  return server
}
