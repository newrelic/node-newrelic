/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const http = require('http')
const assertMetrics = require('../../lib/metrics_helper').assertMetrics
const assertSegments = require('../../lib/metrics_helper').assertSegments
const NAMES = require('../../../lib/metrics/names')
const utils = require('./hapi-utils')
tap.Test.prototype.addAssert('clmAttrs', 1, helper.assertCLMAttrs)

let agent
let server
let port

tap.test('Hapi segments', function (t) {
  t.autoend()

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return server.stop()
  })

  t.test('route handler is recorded as middleware', function (t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function myHandler() {
        return 'ok'
      }
    })

    runTest(t, function (segments, transaction) {
      checkMetrics(t, transaction.metrics, [NAMES.HAPI.MIDDLEWARE + 'myHandler//test'])
      checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      t.end()
    })
  })

  t.test('custom handler type is recorded as middleware', function (t) {
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

    runTest(t, function (segments, transaction) {
      checkMetrics(t, transaction.metrics, [NAMES.HAPI.MIDDLEWARE + 'customHandler//test'])
      checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      t.end()
    })
  })

  t.test('extensions are recorded as middleware', function (t) {
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

    runTest(t, function (segments, transaction) {
      checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'myHandler//test'
      ])
      t.end()
    })
  })

  t.test('custom route handler and extension recorded as middleware', function (t) {
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

    runTest(t, function (segments, transaction) {
      checkMetrics(t, transaction.metrics, [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      checkSegments(t, transaction.trace.root.children[0], [
        NAMES.HAPI.MIDDLEWARE + '<anonymous>//onRequest',
        NAMES.HAPI.MIDDLEWARE + 'customHandler//test'
      ])
      t.end()
    })
  })

  const filepath = 'test/versioned/hapi/segments.tap.js'

  ;[true, false].forEach((clmEnabled) => {
    t.test(
      `should ${
        clmEnabled ? 'add' : 'not add'
      } CLM attribute to extension function and handler function segments when CLM is ${
        clmEnabled ? 'enabled' : 'disabled'
      }`,
      (t) => {
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

        runTest(t, function (segments) {
          const [onRequestSegment, handlerSegment] = segments
          t.clmAttrs({
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
          t.end()
        })
      }
    )

    t.test(
      `should ${
        clmEnabled ? 'add' : 'not add'
      } CLM attribute to custom handler segments when CLM is ${
        clmEnabled ? 'enabled' : 'disabled'
      }`,
      (t) => {
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

        runTest(t, function ([customHandlerSegment]) {
          t.clmAttrs({
            segments: [
              {
                segment: customHandlerSegment,
                name: 'customHandler',
                filepath
              }
            ],
            enabled: clmEnabled
          })
          t.end()
        })
      }
    )

    t.test(
      `should ${
        clmEnabled ? 'add' : 'not add'
      } CLM attribute to plugin handler segments when CLM is ${
        clmEnabled ? 'enabled' : 'disabled'
      }`,
      (t) => {
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
          runTest(t, function ([pluginHandlerSegment]) {
            t.clmAttrs({
              segments: [
                {
                  segment: pluginHandlerSegment,
                  name: 'pluginHandler',
                  filepath
                }
              ],
              enabled: clmEnabled
            })
            t.end()
          })
        })
      }
    )
  })
})

function runTest(t, callback) {
  agent.on('transactionFinished', function (tx) {
    const baseSegment = tx.trace.root.children[0]
    callback(baseSegment.children, tx)
  })

  server.start().then(function () {
    port = server.info.port
    http
      .request({ port: port, path: '/test' }, function (response) {
        response.resume()
      })
      .end()
  })
}

function checkMetrics(t, metrics, expected, path) {
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

function checkSegments(t, segments, expected, opts) {
  t.doesNotThrow(function () {
    assertSegments(segments, expected, opts)
  }, 'should have expected segments')
}
