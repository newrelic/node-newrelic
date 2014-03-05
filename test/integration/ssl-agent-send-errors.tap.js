'use strict';

var path         = require('path')
  , test         = require('tap').test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  ;

test("Agent should send errors to staging-collector.newrelic.com", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 443,
        'ssl'         : true,
        'logging'     : {
          'level' : 'trace'
        }
      })
    , agent = new Agent(config)
    ;

  agent.start(function (error) {
    t.notOk(error, "connected without error");

    var transaction;
    var proxy = agent.tracer.transactionProxy(function () {
      transaction = agent.getTransaction();
      transaction.setName('/nonexistent', 501);
    });
    proxy();
    t.ok(transaction, "got a transaction");
    agent.errors.add(transaction, new Error('test error'));

    agent._sendErrors(function (error) {
      t.notOk(error, "sent errors without error");

      agent.stop(function (error) {
        t.notOk(error, "stopped without error");

        t.end();
      });
    });
  });
});
