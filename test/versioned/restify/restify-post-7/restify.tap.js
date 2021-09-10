/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const request = require('request')
const helper = require('../../../lib/agent_helper')

const METRIC = 'WebTransaction/Restify/GET//hello/:name'

tap.test('Restify', (t) => {
  t.autoend()

  let agent = null
  let restify = null
  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()

    restify = require('restify')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should not crash when handling a connection', function (t) {
    t.plan(7)

    const server = restify.createServer()
    t.teardown(() => server.close())

    agent.on('transactionFinished', () => {
      const metric = agent.metrics.getMetric(METRIC)
      t.ok(metric, 'request metrics should have been gathered')
      t.equals(metric.callCount, 1, 'handler should have been called')
      const isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
      t.ok(isFramework, 'should indicate that restify is a framework')
    })

    server.get('/hello/:name', function sayHello(req, res) {
      t.ok(agent.getTransaction(), 'transaction should be available in handler')
      res.send('hello ' + req.params.name)
    })

    server.listen(0, function () {
      const port = server.address().port
      t.notOk(agent.getTransaction(), 'transaction should not leak into server')

      const url = 'http://localhost:' + port + '/hello/friend'
      request.get(url, function (error, response, body) {
        if (error) {
          return t.fail(error)
        }
        t.notOk(agent.getTransaction(), 'transaction should not leak into external request')
        t.equals(body, '"hello friend"', 'should return expected data')
      })
    })
  })

  t.test('should still be instrumented when run with SSL', function (t) {
    t.plan(7)

    agent.on('transactionFinished', () => {
      const metric = agent.metrics.getMetric(METRIC)

      t.ok(metric, 'request metrics should have been gathered')
      t.equals(metric.callCount, 1, 'handler should have been called')

      const isFramework = agent.environment.get('Framework').indexOf('Restify') > -1
      t.ok(isFramework, 'should indicate that restify is a framework')
    })

    helper
      .withSSL()
      .then(([key, certificate, ca]) => {
        const server = restify.createServer({ key: key, certificate: certificate })
        t.teardown(() => server.close())

        server.get('/hello/:name', function sayHello(req, res) {
          t.ok(agent.getTransaction(), 'transaction should be available in handler')
          res.send('hello ' + req.params.name)
        })

        server.listen(0, function () {
          const port = server.address().port
          t.notOk(agent.getTransaction(), 'transaction should not leak into server')

          const opts = { url: `https://${helper.SSL_HOST}:${port}/hello/friend`, ca }
          request.get(opts, function (error, response, body) {
            if (error) {
              t.fail(error)
              return t.end()
            }

            t.notOk(agent.getTransaction(), 'transaction should not leak into external request')
            t.equals(body, '"hello friend"', 'should return expected data')
          })
        })
      })
      .catch((error) => {
        t.fail('unable to set up SSL: ' + error)
        t.end()
      })
  })
})
