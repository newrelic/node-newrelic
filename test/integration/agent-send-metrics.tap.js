'use strict';

var path         = require('path')
  , test         = require('tap').test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  ;

test("Agent should send metrics to staging-collector.newrelic.com", function (t) {
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
    t.notOk(error, "started without error");

    agent.metrics.measureMilliseconds('TEST/discard', null, 101);
    t.equal(agent.metrics.toJSON().length, 1, "only one metric");

    agent._sendMetrics(function (error) {
      t.notOk(error, "sent metrics without error");

      t.ok(agent.mapper.map('TEST/discard') > 0, "received metric mapping");

      agent.stop(function (error) {
        t.notOk(error, "stopped without error");

        t.end();
      });
    });
  });
});
