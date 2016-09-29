'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var request = require('request').defaults({json: true})

var PORT = 8089

test('Express 3 route param', function(t) {
  var agent = helper.instrumentMockedAgent()
  var express = require('express')
  var server = createServer(express)

  t.tearDown(function() {
    server.close(function() {
      helper.unloadAgent(agent)
    })
  })

  server.listen(PORT, function() {
    t.test('pass-through param', function(t) {
      t.plan(4)

      agent.once('transactionFinished', function(tx) {
        t.equal(
          tx.name, 'WebTransaction/Expressjs/GET//a/:action',
          'should have correct transaction name'
        )
      })

      testRequest('foo', function(err, body) {
        t.notOk(err, 'should not have errored')
        t.equal(body.action, 'foo', 'should pass through correct parameter value')
        t.equal(body.name, 'action', 'should pass through correct parameter name')
      })
    })

    t.test('respond from param', function(t) {
      t.plan(3)

      agent.once('transactionFinished', function(tx) {
        t.equal(
          tx.name, 'WebTransaction/Expressjs/GET//a/:action',
          'should have correct transaction name'
        )
      })

      testRequest('deny', function(err, body) {
        t.notOk(err, 'should not have errored')
        t.equal(body, 'denied', 'should have responded from within paramware')
      })
    })
  })
})

function testRequest(param, cb) {
  var url = 'http://localhost:' + PORT + '/a/' + param
  request.get(url, function(err, response, body) {
    cb(err, body)
  })
}

function createServer(express) {
  var app = express()

  app.param('action', function(req, res, next, action, name) {
    req.action = action
    req.name = name
    if (action === 'deny') {
      res.status(200).json('denied')
    } else {
      next()
    }
  })

  app.get('/a/:action', function(req, res) {
    res.json({action: req.action, name: req.name})
  })

  return require('http').createServer(app)
}
