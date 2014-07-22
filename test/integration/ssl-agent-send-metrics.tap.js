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
        'port'        : 443,
        'ssl'         : true,
        'logging'     : {
          'level' : 'trace'
        }
      })
    , agent = new Agent(config)
    ;

  agent.start(function cb_start(error) {
    t.notOk(error, "started without error");

    agent.metrics.measureMilliseconds('TEST/discard', null, 101);
    t.equal(agent.metrics.toJSON().length, 1, "only one metric");

    agent._sendMetrics(function cb__sendMetrics(error) {
      t.notOk(error, "sent metrics without error");

      agent.stop(function cb_stop(error) {
        t.notOk(error, "stopped without error");

        t.end();
      });
    });
  });
});
