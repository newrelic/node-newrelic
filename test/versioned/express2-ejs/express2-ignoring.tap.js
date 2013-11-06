'use strict';

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  , API     = require(path.join(__dirname, '..', '..', '..', 'api.js'))
  ;

test("ignoring an Express 3 route", function (t) {
  t.plan(7);

  var agent = helper.instrumentMockedAgent()
    , api   = new API(agent)
    , app   = require('express').createServer()
    ;

  this.tearDown(function () {
    app.close(function () {
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

  app.listen(8080, function () {
    request.get('http://localhost:8080/polling/31337',
                function (error, res, body) {

      t.equal(res.statusCode, 400, "got expected error");
      t.deepEqual(body, 'Bad Request', "got expected response");
    });
  });
});
