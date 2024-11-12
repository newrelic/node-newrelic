/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const http = require('node:http')

const helper = require('../../lib/agent_helper')
const assertClmAttrs = require('../../lib/custom-assertions/assert-clm-attrs')
const assertMetrics = require('../../lib/custom-assertions/assert-metrics')
const assertSegments = require('../../lib/custom-assertions/assert-segments')
const utils = require('./hapi-utils')

const NAMES = require('../../../lib/metrics/names')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.server = utils.getServer()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.stop()
})

function runTest(agent, server, callback) {
  agent.on('transactionFinished', function (tx) {
    const [baseSegment] = tx.trace.getChildren(tx.trace.root.id)
    callback(baseSegment, tx)
  })

  server.start().then(function () {
    const port = server.info.port
    http
      .request({ port: port, path: '/test' }, function (response) {
        response.resume()
      })
      .end()
  })
}

function checkMetrics(metrics, expected, path) {
  path = path || '/test'
  const expectedAll = [
    [{ name: 'WebTransaction' }],
    [{ name: 'WebTransactionTotalTime' }],
    [{ name: 'HttpDispatcher' }],
    [{ name: 'WebTransaction/Hapi/GET/' + path }],
    [{ name: 'WebTransactionTotalTime/Hapi/GET/' + path }],
    [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/all' }],
    [{ name: 'DurationByCaller/Unknown/Unknown/Unknown/Unknown/allWeb' }],
    [{ name: 'Apdex/Hapi/GET/' + path }],
    [{ name: 'Apdex' }]
  ]

  for (let i = 0; i < expected.length; i++) {
    const metric = expected[i]
    expectedAll.push([{ name: metric }])
    expectedAll.push([{ name: metric, scope: 'WebTransaction/Hapi/GET/' + path }])
  }

  assertMetrics(metrics, expectedAll, true, false)
}

test('route handler is recorded as middleware', (t, end) => {
  const { agent, server } = t.nr

  server.route({
    method: 'GET',
    path: '/test',
    handler: function myHandler() {
      return 'ok'
    }
  })

  runTest(agent, server, function (baseSegment, transaction) {
    checkMetrics(transaction.metrics, [NAMES.HAPI.MIDDLEWARE + 'myHandler//test'])
    assertSegments(transaction.trace, baseSegment, [NAMES.HAPI.MIDDLEWARE + 'myHandler//test'])
    end()
  })
})

test('custom handler type is recorded as middleware', (t, end) => {
  const { agent, server } = t.nr

  server.decorate('handler', 'customHandler', function (route, options) {
    return function customHandler() {
      return options.key1
    }
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: { customHandler: { key1: 'val1' } }
  })

  runTest(agent, server, function (baseSegment, transaction) {
    checkMetrics(transaction.metrics, [NAMES.HAPI.MIDDLEWARE + 'customHandler//test'])
    assertSegments(transaction.trace, baseSegment, [NAMES.HAPI.MIDDLEWARE + 'customHandler//test'])
    end()
  })
})

test('extensions are recorded as middleware', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onRequest', function (req, h) {
    return h.continue
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: function myHandler() {
      return 'ok'
    }
  })

  runTest(agent, server, function (baseSegment, transaction) {
    checkMetrics(transaction.metrics, [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    assertSegments(transaction.trace, baseSegment, [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
    ])
    end()
  })
})

test('custom route handler and extension recorded as middleware', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onRequest', function (req, h) {
    return h.continue
  })

  server.decorate('handler', 'customHandler', function (route, options) {
    return function customHandler() {
      return options.key1
    }
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: { customHandler: { key1: 'val1' } }
  })

  runTest(agent, server, function (baseSegment, transaction) {
    checkMetrics(transaction.metrics, [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
    ])
    assertSegments(transaction.trace, baseSegment, [
      NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
      NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
    ])
    end()
  })
})

const filepath = 'test/versioned/hapi/segments.test.js'
for (const clmEnabled of [true, false]) {
  test(`should ${
    clmEnabled ? 'add' : 'not add'
  } CLM attribute to extension function and handler function segments when CLM is ${
    clmEnabled ? 'enabled' : 'disabled'
  }`, (t, end) => {
    const { agent, server } = t.nr

    agent.config.code_level_metrics.enabled = clmEnabled
    server.ext('onRequest', function requestExtension(req, h) {
      return h.continue
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        return 'ok'
      }
    })

    runTest(agent, server, function (baseSegment, transaction) {
      const [onRequestSegment, handlerSegment] = transaction.trace.getChildren(baseSegment.id)
      assertClmAttrs({
        segments: [
          {
            segment: onRequestSegment,
            name: 'requestExtension',
            filepath
          },
          {
            segment: handlerSegment,
            name: 'myHandler',
            filepath
          }
        ],
        enabled: clmEnabled
      })
      end()
    })
  })

  test(`should ${
    clmEnabled ? 'add' : 'not add'
  } CLM attribute to custom handler segments when CLM is ${
    clmEnabled ? 'enabled' : 'disabled'
  }`, (t, end) => {
    const { agent, server } = t.nr

    agent.config.code_level_metrics.enabled = clmEnabled
    server.decorate('handler', 'customHandler', function (route, options) {
      return function customHandler() {
        return options.key1
      }
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: { customHandler: { key1: 'val1' } }
    })

    runTest(agent, server, function (baseSegment, transaction) {
      const [customHandlerSegment] = transaction.trace.getChildren(baseSegment.id)
      assertClmAttrs({
        segments: [
          {
            segment: customHandlerSegment,
            name: 'customHandler',
            filepath
          }
        ],
        enabled: clmEnabled
      })
      end()
    })
  })

  test(`should ${
    clmEnabled ? 'add' : 'not add'
  } CLM attribute to plugin handler segments when CLM is ${
    clmEnabled ? 'enabled' : 'disabled'
  }`, (t, end) => {
    const { agent, server } = t.nr

    agent.config.code_level_metrics.enabled = clmEnabled
    const plugin = {
      register: function (srvr) {
        srvr.route({
          method: 'GET',
          path: '/test',
          handler: function pluginHandler() {
            return Promise.resolve('hello')
          }
        })
      },
      name: 'foobar'
    }

    server.register(plugin).then(() => {
      runTest(agent, server, function (baseSegment, transaction) {
        const [pluginHandlerSegment] = transaction.trace.getChildren(baseSegment.id)
        assertClmAttrs({
          segments: [
            {
              segment: pluginHandlerSegment,
              name: 'pluginHandler',
              filepath
            }
          ],
          enabled: clmEnabled
        })
        end()
      })
    })
  })
}
