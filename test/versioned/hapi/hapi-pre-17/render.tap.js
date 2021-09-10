/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const path = require('path')
const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')
const API = require('../../../../api')
const utils = require('./hapi-utils')
const fixtures = require('../fixtures')

tap.test('agent instrumentation of Hapi', function (t) {
  t.plan(4)

  let port = null
  let agent = null
  let server = null

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return new Promise((resolve) => server.stop(resolve))
  })

  t.test('for a normal request', { timeout: 5000 }, function (t) {
    server = utils.getServer()

    // set apdexT so apdex stats will be recorded
    agent.config.apdex_t = 1

    server.route({
      method: 'GET',
      path: '/test',
      handler: function (req, reply) {
        reply({ yep: true })
      }
    })

    server.start(function () {
      port = server.info.port
      request.get('http://localhost:' + port + '/test', function (error, response, body) {
        t.error(error, 'should not error making request')

        t.ok(/application\/json/.test(response.headers['content-type']), 'got correct content type')
        t.deepEqual(JSON.parse(body), { yep: true }, 'response survived')

        let stats = agent.metrics.getMetric('WebTransaction/Hapi/GET//test')
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

  t.test('using EJS templates', { timeout: 1000 }, function (t) {
    const config = {
      options: {
        views: {
          path: path.join(__dirname, '../views'),
          engines: {
            ejs: 'ejs'
          }
        }
      }
    }

    server = utils.getServer(config)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function (req, reply) {
        reply.view('index', { title: 'yo dawg' })
      }
    })

    agent.once('transactionFinished', function () {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, 'should note the view rendering')
    })

    server.start(function () {
      port = server.info.port
      request('http://localhost:' + port + '/test', function (error, response, body) {
        if (error) {
          t.fail(error)
        }

        t.equal(response.statusCode, 200, 'response code should be 200')
        t.equal(body, fixtures.htmlBody, 'template should still render fine')

        t.end()
      })
    })
  })

  t.test('should generate rum headers', { timeout: 1000 }, function (t) {
    const api = new API(agent)

    agent.config.application_id = '12345'
    agent.config.browser_monitoring.browser_key = '12345'
    agent.config.browser_monitoring.js_agent_loader = 'function(){}'

    const config = {
      options: {
        views: {
          path: path.join(__dirname, '../views'),
          engines: {
            ejs: 'ejs'
          }
        }
      }
    }

    server = utils.getServer(config)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function (req, reply) {
        const rum = api.getBrowserTimingHeader()
        t.equal(rum.substr(0, 7), '<script')
        reply.view('index', { title: 'yo dawg', rum: rum })
      }
    })

    agent.once('transactionFinished', function () {
      const stats = agent.metrics.getMetric('View/index/Rendering')
      t.equal(stats.callCount, 1, 'should note the view rendering')
    })

    server.start(function () {
      port = server.info.port
      request('http://localhost:' + port + '/test', function (error, response, body) {
        if (error) {
          t.fail(error)
        }

        t.equal(response.statusCode, 200, 'response code should be 200')
        t.equal(body, fixtures.htmlBody, 'template should still render fine')

        t.end()
      })
    })
  })

  t.test('should trap errors correctly', function (t) {
    // Prevent tap from noticing the ohno failure.
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    server = utils.getServer({ options: { debug: false } })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function () {
        let hmm
        hmm.ohno.failure.is.terrible()
      }
    })

    server.start(function () {
      port = server.info.port
      request.get('http://localhost:' + port + '/test', function (error, response, body) {
        if (error) {
          t.fail(error)
        }

        t.ok(response, 'got a response from Express')
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
