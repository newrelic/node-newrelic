/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const path = require('path')
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
const utils = require('./hapi-utils')
const fixtures = require('./fixtures')

tap.test('agent instrumentation of Hapi', function (t) {
  t.autoend()

  let agent = null
  let server = null
  let port = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('for a normal request', { timeout: 5000 }, function (t) {
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
      port = server.info.port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, response, body) {
        t.error(error, 'should not fail to make request')

        t.ok(/application\/json/.test(response.headers['content-type']), 'got correct content type')
        t.same(body, { yep: true }, 'response survived')

        let stats

        stats = agent.metrics.getMetric('WebTransaction/Hapi/GET//test')
        t.ok(stats, 'found unscoped stats for request path')
        t.equal(stats.callCount, 1, '/test was only requested once')

        stats = agent.metrics.getOrCreateApdexMetric('Apdex/Hapi/GET//test')
        t.ok(stats, 'found apdex stats for request path')
        t.equal(stats.satisfying, 1, 'got satisfactory response time')
        t.equal(stats.tolerating, 0, 'got no tolerable requests')
        t.equal(stats.frustrating, 0, 'got no frustrating requests')

        stats = agent.metrics.getMetric('WebTransaction')
        t.ok(stats, 'found roll-up statistics for web requests')
        t.equal(stats.callCount, 1, 'only one web request was made')

        stats = agent.metrics.getMetric('HttpDispatcher')
        t.ok(stats, 'found HTTP dispatcher statistics')
        t.equal(stats.callCount, 1, 'only one HTTP-dispatched request was made')

        const serialized = JSON.stringify(agent.metrics._toPayloadSync())
        t.ok(
          serialized.match(/WebTransaction\/Hapi\/GET\/\/test/),
          'serialized metrics as expected'
        )

        t.end()
      })
    })
  })

  t.test('using EJS templates', { timeout: 2000 }, function (t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function (req, h) {
        return h.view('index', { title: 'yo dawg' })
      }
    })

    agent.once('transactionFinished', function (tx) {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      t.ok(stats, 'View metric should exist')
      t.equal(stats.callCount, 1, 'should note the view rendering')
      verifyEnded(tx.trace.root, tx)
    })

    function verifyEnded(root, tx) {
      for (let i = 0, len = root.children.length; i < len; i++) {
        const segment = root.children[i]
        t.ok(segment.timer.hasEnd(), util.format('verify %s (%s) has ended', segment.name, tx.id))
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
        port = server.info.port
        helper.makeGetRequest(
          'http://localhost:' + port + '/test',
          function (error, response, body) {
            t.error(error)
            t.equal(response.statusCode, 200, 'response code should be 200')
            t.equal(body, fixtures.htmlBody, 'template should still render fine')

            t.end()
          }
        )
      })
  })

  t.test('should generate rum headers', { timeout: 1000 }, function (t) {
    const api = new API(agent)

    agent.config.application_id = '12345'
    agent.config.browser_monitoring.browser_key = '12345'
    agent.config.browser_monitoring.js_agent_loader = 'function(){}'

    server.route({
      method: 'GET',
      path: '/test',
      handler: function (req, h) {
        const rum = api.getBrowserTimingHeader()
        t.equal(rum.substring(0, 7), '<script')
        return h.view('index', { title: 'yo dawg', rum: rum })
      }
    })

    agent.once('transactionFinished', function () {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      t.ok(stats, 'View metric should exist')
      t.equal(stats.callCount, 1, 'should note the view rendering')
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
        port = server.info.port
        helper.makeGetRequest(
          'http://localhost:' + port + '/test',
          function (error, response, body) {
            t.error(error)

            t.equal(response.statusCode, 200, 'response code should be 200')
            t.equal(body, fixtures.htmlBody, 'template should still render fine')

            t.end()
          }
        )
      })
  })

  t.test('should trap errors correctly', function (t) {
    server = utils.getServer({ options: { debug: false } })

    agent.on('transactionFinished', function (tx) {
      t.equal(
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
      port = server.info.port
      helper.makeGetRequest('http://localhost:' + port + '/test', function (error, response, body) {
        t.error(error)

        t.ok(response, 'got a response from Hapi')
        t.ok(body, 'got back a body')

        const errors = agent.errors.traceAggregator.errors
        t.ok(errors, 'errors were found')
        t.equal(errors.length, 1, 'should be 1 error')

        const first = errors[0]
        t.ok(first, 'have the first error')
        t.match(first[2], 'ohno', 'got the expected error')

        t.end()
      })
    })
  })
})
