'use strict';

var path         = require('path')
  , test         = require('tap').test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorAPI = require(path.join(__dirname, '..', '..', 'lib', 'collector', 'api.js'))
  ;

test("Collector API should send errors to staging-collector.newrelic.com", function (t) {
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
    , api   = new CollectorAPI(agent)
    ;

  api.connect(function (error) {
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

    agent.traces.harvest(function (error, encoded) {
      t.notOk(error, "trace encoded properly");
      t.ok(encoded, "have the encoded trace");

      var payload = [
        agent.config.run_id,
        [encoded] // still needs to be wrapped up in array
      ];

      api.transactionSampleData(payload, function (error, response, json) {
        t.notOk(error, "sent transaction trace without error");
        t.notOk(response, "return value is null");
        t.deepEqual(json, {return_value : null}, "got raw return value");

        t.end();
      });
    });
  });
});
