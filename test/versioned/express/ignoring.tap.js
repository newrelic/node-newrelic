'use strict'

var test = require('tap').test
var request = require('request')
var helper = require('../../lib/agent_helper')
var API = require('../../../api')


test("ignoring an Express route", function(t) {
  t.plan(7)

  const agent = helper.instrumentMockedAgent()

  var api = new API(agent)
  var express = require('express')
  var app = express()
  var server = require('http').createServer(app)


  t.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function(transaction) {
    t.equal(
      transaction.name,
      'WebTransaction/Expressjs/GET//polling/:id',
      "transaction has expected name even on error"
    )

    t.ok(transaction.ignore, "transaction is ignored")

    t.notOk(agent.traces.trace, "should have no transaction trace")

    var metrics = agent.metrics._metrics.unscoped
    t.equal(Object.keys(metrics).length, 1,
      "only supportability metrics added to agent collection"
    )

    var errors = agent.errors.traceAggregator.errors
    t.equal(errors.length, 0, "no errors noticed")
  })

  app.get('/polling/:id', function(req, res) {
    api.setIgnoreTransaction(true)

    res.status(400).send({status : 'pollpollpoll'})
    res.end()
  })

  server.listen(0, function() {
    var port = server.address().port
    var url = 'http://localhost:' + port + '/polling/31337'
    request.get(url, {json : true}, function(error, res, body) {
      t.equal(res.statusCode, 400, "got expected error")
      t.deepEqual(body, {status : 'pollpollpoll'}, "got expected response")
    })
  })
})
