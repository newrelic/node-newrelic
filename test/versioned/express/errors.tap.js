/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var helper = require('../../lib/agent_helper')
var http = require('http')
var tap = require('tap')

var express
var agent
var app

runTests({
  express_segments: false
})

runTests({
  express_segments: true
})

function runTests(flags) {
  tap.test('reports error when thrown from a route', function(t) {
    setup(t)

    app.get('/test', function() {
      throw new Error('some error')
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(statusCode, 500)
      t.end()
    })
  })

  tap.test('reports error when thrown from a middleware', function(t) {
    setup(t)

    app.use(function() {
      throw new Error('some error')
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(statusCode, 500)
      t.end()
    })
  })

  tap.test('reports error when called in next from a middleware', function(t) {
    setup(t)

    app.use(function(req, res, next) {
      next( new Error('some error'))
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 1)
      t.equals(statusCode, 500)
      t.end()
    })
  })

  tap.test('should not report error when error handler responds', function(t) {
    setup(t)

    app.get('/test', function() {
      throw new Error('some error')
    })

    app.use(function(error, req, res, next) { // eslint-disable-line no-unused-vars
      res.end()
    })

    runTest(t, function(errors, statusCode) {
      t.equals(errors.length, 0)
      t.equals(statusCode, 200)
      t.end()
    })
  })

  tap.test(
    'should report error when error handler responds, but sets error status code',
    function(t) {
      setup(t)

      app.get('/test', function() {
        throw new Error('some error')
      })

      app.use(function(error, req, res, next) { // eslint-disable-line no-unused-vars
        res.status(400).end()
      })

      runTest(t, function(errors, statusCode) {
        t.equals(errors.length, 1)
        t.equals(errors[0][2], 'some error')
        t.equals(statusCode, 400)
        t.end()
      })
    }
  )

  tap.test('should report errors passed out of errorware', function(t) {
    setup(t)

    app.get('/test', function() {
      throw new Error('some error')
    })

    app.use(function(error, req, res, next) {
      next(error)
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 1)
      t.equals(statuscode, 500)
      t.end()
    })
  })

  tap.test('should report errors from errorware followed by routes', function(t) {
    setup(t)

    app.use(function() {
      throw new Error('some error')
    })

    app.use(function(error, req, res, next) {
      next(error)
    })

    app.get('/test', function(req, res) {
      res.end()
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 1)
      t.equals(statuscode, 500)
      t.end()
    })
  })

  tap.test('should not report errors swallowed by errorware', function(t) {
    setup(t)

    app.get('/test', function() {
      throw new Error('some error')
    })

    app.use(function(err, req, res, next) {
      next()
    })

    app.get('/test', function(req, res) {
      res.end()
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 0)
      t.equals(statuscode, 200)
      t.end()
    })
  })

  tap.test('should not report errors handled by errorware outside router', function(t) {
    setup(t)

    var router1 = express.Router() // eslint-disable-line new-cap
    router1.get('/test', function() {
      throw new Error('some error')
    })

    app.use(router1)

    app.use(function(error, req, res, next) { // eslint-disable-line no-unused-vars
      res.end()
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 0)
      t.equals(statuscode, 200)
      t.end()
    })
  })

  tap.test('does not error when request is aborted', function(t) {
    t.plan(3)
    setup(t)

    var request = null

    app.get('/test', function(req, res, next) {
      t.comment('middleware')
      t.ok(agent.getTransaction(), 'transaction exists')

      // generate error after client has aborted
      request.abort()
      setTimeout(function() {
        t.comment('timed out')
        t.ok(agent.getTransaction() == null, 'transaction has already ended')
        next(new Error('some error'))
      }, 100)
    })

    app.use(function(error, req, res, next) { // eslint-disable-line no-unused-vars
      t.comment('errorware')
      t.ok(agent.getTransaction() == null, 'no active transaction when responding')
      res.end()
    })

    var server = app.listen(function() {
      t.comment('making request')
      var port = server.address().port
      request = http.request({
        hostname: 'localhost',
        port: port,
        path: '/test'
      }, function() {})
      request.end()

      // add error handler, otherwise aborting will cause an exception
      request.on('error', function(err) {
        t.comment('request errored: ' + err)
      })
      request.on('abort', function() {
        t.comment('request aborted')
      })
    })

    t.tearDown(function() {
      server.close()
    })
  })

  function setup(t) {
    agent = helper.instrumentMockedAgent(flags)

    express = require('express')
    app = express()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
  }

  function runTest(t, callback) {
    var statusCode
    var errors

    agent.on('transactionFinished', function() {
      errors = agent.errors.traceAggregator.errors
      if (statusCode) {
        callback(errors, statusCode)
      }
    })

    var endpoint = '/test'
    var server = app.listen(function() {
      makeRequest(server, endpoint, function(response) {
        statusCode = response.statusCode
        if (errors) {
          callback(errors, statusCode)
        }
        response.resume()
      })
    })
    t.tearDown(function() {
      server.close()
    })
  }

  function makeRequest(server, path, callback) {
    var port = server.address().port
    http.request({port: port, path: path}, callback).end()
  }
}
