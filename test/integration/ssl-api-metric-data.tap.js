'use strict';

var path         = require('path')
  , test         = require('tap').test
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorAPI = require(path.join(__dirname, '..', '..', 'lib', 'collector', 'api.js'))
  ;

test("Collector API should send metrics to staging-collector.newrelic.com", function (t) {
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
    , api   = new CollectorAPI(agent)
    ;

  api.connect(function cb_connect(error) {
    t.notOk(error, "connected without error");

    agent.metrics.measureMilliseconds('TEST/discard', null, 101);
    t.equal(agent.metrics.toJSON().length, 1, "only one metric");

    var payload = [
      agent.config.run_id,
      agent.metrics.started  / 1000,
      Date.now() / 1000,
      agent.metrics
    ];

    api.metricData(payload, function (error, response) {
      t.notOk(error, "sent metrics without error");
      t.ok(response, "got a response");

      t.equal(response.length, 0, "got back no mappings");
      t.doesNotThrow(function cb_doesNotThrow() {
        agent.mapper.load(response);
      }, "was able to load mapping");

      t.end();
    });
  });
});
