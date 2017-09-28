'use strict'

var helper = require('../../lib/agent_helper.js')
var http = require('http')
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
  test('reports error when thrown from a route', function(t) {
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

  test('reports error when thrown from a middleware', function(t) {
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

  test('reports error when called in next from a middleware', function(t) {
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

  test('should report the error when error handler calls next with the error', function(t) {
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

  test('does not error when request is aborted', function(t) {
    t.plan(3)
    setup(t)

    app.get('/test', function(req, res, next) {
      t.ok(agent.getTransaction(), 'transaction exists')
      // generate error after client has aborted
      setTimeout(function() {
        t.ok(agent.getTransaction() == null, 'transaction has already ended')
        next(new Error('some error'))
      }, 20)
    })

    app.use(function(error, req, res, next) {
      t.ok(agent.getTransaction() == null, 'no active transaction when responding')
      res.end()
    })

    var server = app.listen(function() {
      var port = server.address().port
      var req = http.request({port: port, path: '/test'}, function() {})
      req.end()
      // add error handler, otherwise aborting will cause an exception
      req.on('error', function() {})

      setTimeout(function() {
        req.abort()
      }, 10)
    })

    t.tearDown(function cb_tearDown() {
      server.close()
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
