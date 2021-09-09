/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../../lib/agent_helper')
const http = require('http')
const tap = require('tap')
const utils = require('./hapi-utils')

let agent
let server
let port

tap.test('Hapi v16 error handling', function (t) {
  t.autoend()

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()

    server = utils.getServer()
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    return new Promise((resolve) => server.stop(resolve))
  })

  t.test('does not report error when reply is called with a string', function (t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function (request, reply) {
        reply('ok')
      }
    })

    runTest(t, function (errors, statusCode) {
      t.equals(errors.length, 0)
      t.equals(statusCode, 200)
      t.end()
    })
  })

  t.test('reports error when reply is called with an instance of Error', function (t) {
    server.route({
      method: 'GET',
      path: '/test',
      handler: function (request, reply) {
        reply(new Error('some error'))
      }
    })

    runTest(t, function (errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })

  t.test('reports error when thrown from a route', function (t) {
    // Prevent tap from noticing the ohno failure.
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    server.route({
      method: 'GET',
      path: '/test',
      handler: function () {
        throw new Error('some error')
      }
    })

    runTest(t, function (errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'Uncaught error: some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })

  t.test('reports error when thrown from a middleware', function (t) {
    // Prevent tap from noticing the ohno failure.
    helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

    server.ext('onRequest', function () {
      throw new Error('some error')
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: function (request, reply) {
        reply('ok')
      }
    })

    runTest(t, function (errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(errors[0][2], 'Uncaught error: some error')
      t.equals(statusCode, 500)
      t.end()
    })
  })

  t.test('reports error when error handler replies with transformed error', (t) => {
    server.ext('onPreResponse', (req, reply) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      req.response.output.statusCode = 400
      reply(req.response)
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: (req, reply) => {
        reply(new Error('route handler error'))
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 400, 'has expected 400 status code')
      t.end()
    })
  })

  t.test('reports error when error handler continues with transformed response', (t) => {
    server.ext('onPreResponse', (req, reply) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      req.response.output.statusCode = 400
      reply.continue()
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: (req, reply) => {
        reply(new Error('route handler error'))
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 400, 'has expected 400 status code')
      t.end()
    })
  })

  t.test('reports error when error handler continues with original response', (t) => {
    server.ext('onPreResponse', (req, reply) => {
      t.ok(req.response instanceof Error, 'preResponse has error')
      reply.continue()
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: (req, reply) => {
        reply(new Error('route handler error'))
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 1, 'has 1 reported error')
      t.equals(errors[0][2], 'route handler error', 'has correct error message')
      t.equals(statusCode, 500, 'has expected 500 status code')
      t.end()
    })
  })

  t.test('should not report error when error handler responds', (t) => {
    server.ext('onPreResponse', (req, reply) => {
      t.ok(req.response.isBoom, 'preResponse has error')
      return reply()
    })

    server.route({
      method: 'GET',
      path: '/test',
      handler: (req, reply) => {
        reply(new Error('route handler error'))
      }
    })

    runTest(t, (errors, statusCode) => {
      t.equals(errors.length, 0, 'has no reported errors')
      t.equals(statusCode, 200, 'has expected 200 status')
      t.end()
    })
  })
})

function runTest(t, callback) {
  let statusCode
  let errors

  agent.on('transactionFinished', function () {
    errors = agent.errors.traceAggregator.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  const endpoint = '/test'
  server.start(function () {
    port = server.info.port
    makeRequest(server, endpoint, function (response) {
      statusCode = response.statusCode
      if (errors) {
        callback(errors, statusCode)
      }
      response.resume()
    })
  })
}

function makeRequest(serv, path, callback) {
  http.request({ port: port, path: path }, callback).end()
}
