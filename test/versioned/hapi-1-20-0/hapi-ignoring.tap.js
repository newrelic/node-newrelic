'use strict';

// hapi 1.20.0 depends on node 0.10.x
if (process.version.split('.')[1] < 10) {
  console.log('TAP version 13\n# disabled because of incompatibility');
  console.log('ok 1 nothing to do\n\n1..1\n\n# ok');
  process.exit(0);
}

var path    = require('path')
  , test    = require('tap').test
  , request = require('request')
  , helper  = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper.js'))
  , API     = require(path.join(__dirname, '..', '..', '..', 'api.js'))
  ;

test("ignoring a Hapi route", function (t) {
  t.plan(7);

  var agent  = helper.instrumentMockedAgent()
    , api    = new API(agent)
    , hapi   = require('hapi')
    , server = hapi.createServer('localhost', 8080)
    ;

  this.tearDown(function () {
    server.stop(function () {
      helper.unloadAgent(agent);
    });
  });

  agent.on('transactionFinished', function (transaction) {
    t.equal(transaction.name, 'WebTransaction/Hapi/GET//order/{id}',
            "transaction has expected name even on error");
    t.ok(transaction.ignore, "transaction is ignored");

    t.notOk(agent.traces.trace, "should have no transaction trace");

    var metrics = agent.metrics.unscoped;
    t.equal(Object.keys(metrics).length, 0, "no metrics added to agent collection");

    var errors = agent.errors.errors;
    t.equal(errors.length, 0, "no errors noticed");
  });

  server.route({
    method  : 'GET',
    path    : '/order/{id}',
    handler : function () {
      api.setIgnoreTransaction(true);

      this.reply({status : 'cartcartcart'}).code(400);
    }
  });

  server.start(function () {
    request.get('http://localhost:8080/order/31337',
                {json : true},
                function (error, res, body) {

      t.equal(res.statusCode, 400, "got expected error");
      t.deepEqual(body, {status : 'cartcartcart'}, "got expected response");
    });
  });
});
