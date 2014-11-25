'use strict'

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require('../../lib/agent_helper.js')
  , API     = require('../../../api.js')


test("Restify router introspection", function (t) {
  t.plan(7)

  var agent  = helper.instrumentMockedAgent()
    , api    = new API(agent)
    , server = require('restify').createServer()


  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent)
    })
  })

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Restify/GET//polling/:id',
            "transaction has expected name even on error")
    t.ok(transaction.ignore, "transaction is ignored")

    t.notOk(agent.traces.trace, "should have no transaction trace")

    var metrics = agent.metrics.unscoped
    t.equal(Object.keys(metrics).length, 0, "no metrics added to agent collection")

    var errors = agent.errors.errors
    t.equal(errors.length, 0, "no errors noticed")
  })

  server.get('/polling/:id', function (req, res, next) {
    api.setIgnoreTransaction(true)

    res.send(400, {status : 'pollpollpoll'})
    next()
  })

  server.listen(8089, function () {
    request.get('http://localhost:8089/polling/31337',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 400, "got expected error")
      t.deepEqual(body, {status : 'pollpollpoll'}, "got expected response")
    })
  })
})
