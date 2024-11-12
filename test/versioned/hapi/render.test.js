/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const util = require('node:util')
const path = require('node:path')

const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')
const fixtures = require('./fixtures')
const match = require('../../lib/custom-assertions/match')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

test('for a normal request', { timeout: 5000 }, (t, end) => {
  const { agent, server } = t.nr

  // set apdexT so apdex stats will be recorded
  agent.config.apdex_t = 1

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      return { yep: true }
    }
  })

  server.start().then(function () {
    const port = server.info.port
    helper.makeGetRequest('http://localhost:' + port + '/test', function (error, response, body) {
      assert.ifError(error, 'should not fail to make request')

      assert.ok(
        /application\/json/.test(response.headers['content-type']),
        'got correct content type'
      )
      assert.deepStrictEqual(body, { yep: true }, 'response survived')

      let stats

      stats = agent.metrics.getMetric('WebTransaction/Hapi/GET//test')
      assert.ok(stats, 'found unscoped stats for request path')
      assert.equal(stats.callCount, 1, '/test was only requested once')

      stats = agent.metrics.getOrCreateApdexMetric('Apdex/Hapi/GET//test')
      assert.ok(stats, 'found apdex stats for request path')
      assert.equal(stats.satisfying, 1, 'got satisfactory response time')
      assert.equal(stats.tolerating, 0, 'got no tolerable requests')
      assert.equal(stats.frustrating, 0, 'got no frustrating requests')

      stats = agent.metrics.getMetric('WebTransaction')
      assert.ok(stats, 'found roll-up statistics for web requests')
      assert.equal(stats.callCount, 1, 'only one web request was made')

      stats = agent.metrics.getMetric('HttpDispatcher')
      assert.ok(stats, 'found HTTP dispatcher statistics')
      assert.equal(stats.callCount, 1, 'only one HTTP-dispatched request was made')

      const serialized = JSON.stringify(agent.metrics._toPayloadSync())
      assert.ok(
        serialized.match(/WebTransaction\/Hapi\/GET\/\/test/),
        'serialized metrics as expected'
      )

      end()
    })
  })
})

test('using EJS templates', { timeout: 2000 }, (t, end) => {
  const { agent, server } = t.nr

  server.route({
    method: 'GET',
    path: '/test',
    handler: function (req, h) {
      return h.view('index', { title: 'yo dawg' })
    }
  })

  agent.once('transactionFinished', function (tx) {
    const stats = agent.metrics.getMetric('View/index/Rendering')
    assert.ok(stats, 'View metric should exist')
    assert.equal(stats.callCount, 1, 'should note the view rendering')
    verifyEnded(tx.trace.root, tx)
  })

  function verifyEnded(root, tx) {
    for (let i = 0, len = root.children.length; i < len; i++) {
      const segment = root.children[i]
      assert.ok(
        segment.timer.hasEnd(),
        util.format('verify %s (%s) has ended', segment.name, tx.id)
      )
      if (segment.children) {
        verifyEnded(segment, tx)
      }
    }
  }

  server
    .register(require('@hapi/vision'))
    .then(function () {
      server.views({
        path: path.join(__dirname, './views'),
        engines: {
          ejs: require('ejs')
        }
      })
      return server.start()
    })
    .then(function () {
      const port = server.info.port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, response, body) {
        assert.ifError(error)
        assert.equal(response.statusCode, 200, 'response code should be 200')
        assert.equal(body, fixtures.htmlBody, 'template should still render fine')

        end()
      })
    })
})

test('should generate rum headers', { timeout: 1000 }, (t, end) => {
  const { agent, server } = t.nr
  const api = new API(agent)

  agent.config.application_id = '12345'
  agent.config.browser_monitoring.browser_key = '12345'
  agent.config.browser_monitoring.js_agent_loader = 'function(){}'

  server.route({
    method: 'GET',
    path: '/test',
    handler: function (req, h) {
      const rum = api.getBrowserTimingHeader()
      assert.equal(rum.substring(0, 7), '<script')
      return h.view('index', { title: 'yo dawg', rum: rum })
    }
  })

  agent.once('transactionFinished', function () {
    const stats = agent.metrics.getMetric('View/index/Rendering')
    assert.ok(stats, 'View metric should exist')
    assert.equal(stats.callCount, 1, 'should note the view rendering')
  })

  server
    .register(require('@hapi/vision'))
    .then(function () {
      server.views({
        path: path.join(__dirname, './views'),
        engines: {
          ejs: require('ejs')
        }
      })
      return server.start()
    })
    .then(function () {
      const port = server.info.port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, response, body) {
        assert.ifError(error)

        assert.equal(response.statusCode, 200, 'response code should be 200')
        assert.equal(body, fixtures.htmlBody, 'template should still render fine')

        end()
      })
    })
})

test('should trap errors correctly', (t, end) => {
  const { agent } = t.nr
  const server = utils.getServer({ options: { debug: false } })

  t.after(() => server.stop())

  agent.on('transactionFinished', function (tx) {
    assert.equal(
      tx.name,
      'WebTransaction/Hapi/GET/' + '/test',
      'Transaction should be named correctly.'
    )
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      let hmm
      hmm.ohno.failure.is.terrible()
    }
  })

  server.start().then(function () {
    const port = server.info.port
    helper.makeGetRequest(
      'http://localhost:' + port + '/test',
      {},
      function (error, response, body) {
        assert.ifError(error)

        assert.ok(response, 'got a response from Hapi')
        assert.ok(body, 'got back a body')

        const errors = agent.errors.traceAggregator.errors
        assert.ok(errors, 'errors were found')
        assert.equal(errors.length, 1, 'should be 1 error')

        const first = errors[0]
        assert.ok(first, 'have the first error')
        assert.match(first[2], /ohno/, 'got the expected error')

        end()
      }
    )
  })
})
