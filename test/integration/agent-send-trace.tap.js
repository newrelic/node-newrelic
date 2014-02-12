'use strict';

var path         = require('path')
  , test         = require('tap').test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  ;

test("Agent should send trace to staging-collector.newrelic.com", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 80,
        'ssl'         : false,
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
      transaction.setName('/nonexistent', 200);
    });
    proxy();
    // ensure it's slow enough to get traced
    transaction.getTrace().setDurationInMillis(5001);
    transaction.end();

    t.ok(agent.traces.trace, "have a slow trace to send");

    agent._sendTrace(function (error) {
      t.notOk(error, "trace sent correctly");

      agent.stop(function (error) {
        t.notOk(error, "stopped without error");

        t.end();
      });
    });
  });
});
