'use strict'

var path = require('path')
var assert = require('assert')
var chai = require('chai')
var http = require('http')
var should = chai.should()
var expect = chai.expect
var EventEmitter = require('events').EventEmitter
var helper = require('../../../lib/agent_helper')

describe("built-in http queueTime", function () {
  var agent
  var testDate
  var PORT
  var THRESHOLD

  before(function () {
    agent = helper.instrumentMockedAgent()
    testDate = Date.now()
    PORT = 0
    THRESHOLD = 200
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  it("header should allow t=${time} style headers", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-request-start": "t=" + (testDate - 10)
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("bad header should log a warning", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert.equal(transTime, 0, 'queueTime is not added')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-request-start": "alskdjf"
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("x-request should verify milliseconds", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-request-start": testDate - 10
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("x-queue should verify milliseconds", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-queue-start": testDate - 10
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("x-request should verify microseconds", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-request-start": (testDate - 10) * 1e3
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("x-queue should verify nanoseconds", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

      server.listen(PORT, function () {
        var port = server.address().port
        var opts = {
          host: 'localhost',
          port: port,
          headers: {
            "x-queue-start": (testDate - 10) * 1e6
          }
        }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })

  it("x-request should verify seconds", function (done) {
    var server

    server = http.createServer(function cb_createServer(request, response) {
      var transTime = agent.getTransaction().queueTime
      assert(transTime > 0, 'must be positive')
      assert(transTime < THRESHOLD, 'should be less than ' + THRESHOLD + 'ms (' + transTime + 'ms)')
      response.end()
    })

    server.listen(PORT, function () {
      var port = server.address().port
      var opts = {
        host: 'localhost',
        port: port,
        headers: {
          "x-request-start": (testDate - 10) / 1e3
        }
      }
      http.get(opts, function () {
        server.close()
        return done()
      })
    })
  })
})
