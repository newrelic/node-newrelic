/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const http = require('node:http')
const semver = require('semver')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')

// Connect logs stack traces if NODE_ENV is not set to "test"
process.env.NODE_ENV = 'test'

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
  ctx.nr.connect = require('connect')
  ctx.nr.pkgVersion = require('connect/package').version
  ctx.nr.app = ctx.nr.connect()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['connect'])
})

test('should properly name transaction from route name', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, app, pkgVersion } = t.nr

  agent.once('transactionFinished', (tx) => {
    plan.equal(tx.name, 'WebTransaction/Connect/GET//foo')
    plan.equal(tx.url, '/foo', 'URL is left alone')
    plan.equal(tx.verb, 'GET', 'HTTP method is GET')
    plan.equal(tx.statusCode, 200, 'status code is OK')
    plan.ok(tx.trace, 'transaction has trace')
    const [web] = tx.trace.getChildren(tx.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, tx.name, 'segment name and transaction name match')
    plan.equal(web.partialName, 'Connect/GET//foo', 'should have partial name for apdex')
  })

  function middleware(req, res) {
    plan.ok(agent.getTransaction(), 'transaction should be available')
    res.end('foo')
  }

  app.use('/foo', middleware)
  const server = createServerAndMakeRequest({
    url: '/foo',
    expectedData: 'foo',
    plan,
    app,
    pkgVersion
  })
  t.after(() => server.close())

  await plan.completed
})

test('should default to `/` when no route is specified', async (t) => {
  const plan = tspl(t, { plan: 10 })
  const { agent, app, pkgVersion } = t.nr

  agent.once('transactionFinished', (tx) => {
    plan.equal(tx.name, 'WebTransaction/Connect/GET//')
    plan.equal(tx.url, '/foo', 'URL is left alone')
    plan.equal(tx.verb, 'GET', 'HTTP method is GET')
    plan.equal(tx.statusCode, 200, 'status code is OK')
    plan.ok(tx.trace, 'transaction has trace')
    const [web] = tx.trace.getChildren(tx.trace.root.id)
    plan.ok(web, 'trace has web segment')
    plan.equal(web.name, tx.name, 'segment name and transaction name match')
    plan.equal(web.partialName, 'Connect/GET//', 'should have partial name for apdex')
  })

  function middleware(req, res) {
    plan.ok(agent.getTransaction(), 'transaction should be available')
    res.end('root')
  }

  app.use(middleware)
  const server = createServerAndMakeRequest({
    url: '/foo',
    expectedData: 'root',
    plan,
    app,
    pkgVersion
  })
  t.after(() => server.close())

  await plan.completed
})

/**
 * Sets up HTTP server and binds a connect instance.
 * It then makes a request to specified url and asserts the response
 * data is correct.
 *
 * @param {Object} params params object
 * @param {string} params.url url to make request
 * @param {string} params.expectedData expected response data
 * @param {Object} params.plan plan object
 * @param {Object} params.app connect app
 * @param {string} params.pkgVersion connect package version
 * @returns {http.Server}
 */
function createServerAndMakeRequest({ url, expectedData, plan, app, pkgVersion }) {
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
          plan.equal(data.toString(), expectedData, 'should respond with proper data')
        })
      }
    )
    req.end()
  })

  return server
}
