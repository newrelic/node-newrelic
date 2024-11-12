/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')

const helper = require('../../lib/agent_helper')
const utils = require('./hapi-utils')

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
  let statusCode
  let errors

  agent.on('transactionFinished', function () {
    errors = agent.errors.traceAggregator.errors
    if (statusCode) {
      callback(errors, statusCode)
    }
  })

  const endpoint = '/test'
  server.start().then(function () {
    makeRequest(endpoint, server.info.port, function (response) {
      statusCode = response.statusCode
      if (errors) {
        callback(errors, statusCode)
      }
      response.resume()
    })
  })
}

function makeRequest(path, port, callback) {
  http.request({ port, path }, callback).end()
}

test('does not report error when handler returns a string', (t, end) => {
  const { agent, server } = t.nr

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      return 'ok'
    }
  })

  runTest(agent, server, function (errors, statusCode) {
    assert.equal(errors.length, 0, 'should have no errors')
    assert.equal(statusCode, 200, 'should have a 200 status code')
    end()
  })
})

test('reports error when an instance of Error is returned', (t, end) => {
  const { agent, server } = t.nr

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      return Promise.reject(new Error('rejected promise error'))
    }
  })

  runTest(agent, server, function (errors, statusCode) {
    assert.equal(errors.length, 1, 'should have one error')
    assert.equal(errors[0][2], 'rejected promise error', 'should have expected error message')
    assert.equal(statusCode, 500, 'should have expected error code')
    end()
  })
})

test('reports error when thrown from a route', (t, end) => {
  const { agent, server } = t.nr

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      throw new Error('thrown error')
    }
  })

  runTest(agent, server, function (errors, statusCode) {
    assert.equal(errors.length, 1, 'should have one error')
    assert.equal(errors[0][2], 'thrown error', 'should have expected error message')
    assert.equal(statusCode, 500, 'should have expected error code')
    end()
  })
})

test('reports error when thrown from a middleware', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onRequest', function () {
    throw new Error('middleware error')
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: function () {
      return 'ok'
    }
  })

  runTest(agent, server, function (errors, statusCode) {
    assert.equal(errors.length, 1, 'should have one error')
    assert.equal(errors[0][2], 'middleware error', 'should have expected error message')
    assert.equal(statusCode, 500, 'should have expected error code')
    end()
  })
})

test('reports error when error handler replies with transformed error', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onPreResponse', (req) => {
    assert.ok(req.response instanceof Error, 'preResponse has error')
    req.response.output.statusCode = 400
    return req.response
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: () => {
      throw new Error('route handler error')
    }
  })

  runTest(agent, server, (errors, statusCode) => {
    assert.equal(errors.length, 1, 'has 1 reported error')
    assert.equal(errors[0][2], 'route handler error', 'has correct error message')
    assert.equal(statusCode, 400, 'has expected 400 status code')
    end()
  })
})

test('reports error when error handler continues with transformed response', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onPreResponse', (req, h) => {
    assert.ok(req.response instanceof Error, 'preResponse has error')
    req.response.output.statusCode = 400
    return h.continue
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: () => {
      throw new Error('route handler error')
    }
  })

  runTest(agent, server, (errors, statusCode) => {
    assert.equal(errors.length, 1, 'has 1 reported error')
    assert.equal(errors[0][2], 'route handler error', 'has correct error message')
    assert.equal(statusCode, 400, 'has expected 400 status code')
    end()
  })
})

test('reports error when error handler continues with original response', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onPreResponse', (req, h) => {
    assert.ok(req.response instanceof Error, 'preResponse has error')
    return h.continue
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: () => {
      throw new Error('route handler error')
    }
  })

  runTest(agent, server, (errors, statusCode) => {
    assert.equal(errors.length, 1, 'has 1 reported error')
    assert.equal(errors[0][2], 'route handler error', 'has correct error message')
    assert.equal(statusCode, 500, 'has expected 500 status code')
    end()
  })
})

test('should not report error when error handler responds', (t, end) => {
  const { agent, server } = t.nr

  server.ext('onPreResponse', (req) => {
    assert.ok(req.response.isBoom, 'preResponse has error')
    return null
  })

  server.route({
    method: 'GET',
    path: '/test',
    handler: () => {
      throw new Error('route handler error')
    }
  })

  runTest(agent, server, (errors, statusCode) => {
    assert.equal(errors.length, 0, 'has no reported errors')
    assert.ok([200, 204].includes(statusCode), 'has expected 200 or 204 status code')
    end()
  })
})
