'use strict'

var path = require('path')
var helper = require('../../lib/agent_helper.js')
var http = require('http')
var skip = require('./skip')
var skip = require('./skip')

var test = require('tap').test

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
  test('reports error when thrown from a route',
      { skip: skip() }, function(t) {
    setup(t)

    app.get('/test', function(req, res) {
      throw new Error('some error')
    })

    runTest(t, function(errors, statusCode) {
     t.equals(errors.length, 1)
     t.equals(statusCode, 500)
     t.end()
    })
  })

  test('reports error when thrown from a middleware',
      { skip: skip() }, function(t) {
    setup(t)

    app.use(function(req, res, next) {
      throw new Error('some error')
    })

    runTest(t, function(errors, statusCode) {
     t.equals(errors.length, 1)
     t.equals(statusCode, 500)
     t.end()
    })
  })

  test('reports error when called in next from a middleware',
      { skip: skip() }, function(t) {
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

  test('should not report error when error handler responds', function(t) {
   setup(t)

   app.get('/test', function(req, res) {
     throw new Error('some error')
   })

   app.use(function(error, req, res, next) {
     res.end()
   })

   runTest(t, function(errors, statusCode) {
     t.equals(errors.length, 0)
     t.equals(statusCode, 200)
     t.end()
   })
  })

  test('should report error when error handler responds, but sets error status code',
      function(t) {
   setup(t)

   app.get('/test', function(req, res) {
     throw new Error('some error')
   })

   app.use(function(error, req, res, next) {
     res.status(400).end()
   })

   runTest(t, function(errors, statusCode) {
     t.equals(errors.length, 1)
     t.equals(errors[0][2], 'some error')
     t.equals(statusCode, 400)
     t.end()
   })
  })

  test('should report the error when error handler calls next with the error',
      { skip: skip() }, function(t) {
   setup(t)

   app.get('/test', function(req, res) {
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

  test('should report error when error handler does not handle error and is followed by ' +
      'a route handler', function(t) {
   setup(t)

   app.use(function(req, res, next) {
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

  test('should not report error when error handler calls next without the error and is ' +
      'followed by a route handler', function(t) {
    setup(t)

    app.get('/test', function(req, res, next) {
      throw new Error('some error')
    })

    app.use(function(err, req, res, next) {
      next()
    })

    app.get('/test', function (req, res) {
      res.end()
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 0)
      t.equals(statuscode, 200)
      t.end()
    })
  })

  test('should not report error when error is thrown in a nested router but handled in' +
      ' error handler outside of the router', function(t) {
    setup(t)

    var router1 = express.Router()
    router1.get('/test', function(req, res) {
      throw new Error('some error')
    })

    app.use(router1)

    app.use(function(error, req, res, next) {
      res.end()
    })

    runTest(t, function(errors, statuscode) {
      t.equals(errors.length, 0)
      t.equals(statuscode, 200)
      t.end()
    })
  })

  function setup(t) {
    agent = helper.instrumentMockedAgent(flags)
    express = require('express')
    app = express()
    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })
  }

  function runTest(t, callback) {
    var statusCode
    var errors

    agent.on('transactionFinished', function(tx) {
      errors = agent.errors.errors
      if (statusCode) {
        callback(errors, statusCode)
      }
    })

    var endpoint = '/test'
    var server = app.listen(function(){
      makeRequest(server, endpoint, function(response) {
        statusCode = response.statusCode
        if (errors) {
          callback(errors, statusCode)
        }
        response.resume()
      })
    })
    t.tearDown(function cb_tearDown() {
      server.close()
    })
  }

  function makeRequest(server, path, callback) {
    var port = server.address().port
    http.request({port: port, path: path}, callback).end()
  }
}
