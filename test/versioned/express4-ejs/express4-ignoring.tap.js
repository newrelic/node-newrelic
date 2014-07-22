'use strict';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  , API     = require(path.join(__dirname, '..', '..', '..', 'api.js'))
  ;

test("ignoring an Express 4 route", function (t) {
  t.plan(7);

  var agent   = helper.instrumentMockedAgent()
    , api     = new API(agent)
    , express = require('express')
    , app     = express()
    , server  = require('http').createServer(app)
    ;

  this.tearDown(function cb_tearDown() {
    server.close(function cb_close() {
      helper.unloadAgent(agent);
    });
  });

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Expressjs/GET//polling/:id',
            "transaction has expected name even on error");
    t.ok(transaction.ignore, "transaction is ignored");

    t.notOk(agent.traces.trace, "should have no transaction trace");

    var metrics = agent.metrics.unscoped;
    t.equal(Object.keys(metrics).length, 0, "no metrics added to agent collection");

    var errors = agent.errors.errors;
    t.equal(errors.length, 0, "no errors noticed");
  });

  app.get('/polling/:id', function (req, res) {
    api.setIgnoreTransaction(true);

    res.send(400, {status : 'pollpollpoll'});
    res.end();
  });

  server.listen(8080, function () {
    request.get('http://localhost:8080/polling/31337',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 400, "got expected error");
      t.deepEqual(body, {status : 'pollpollpoll'}, "got expected response");
    });
  });
});
