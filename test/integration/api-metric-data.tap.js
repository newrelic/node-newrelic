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

      t.equal(response.length, 1, "got back 1 metric mapping");
      var mapping = response[0];
      t.ok(Array.isArray(mapping), "metric mapping is an array");
      var tag = mapping[0];
      t.equal(tag.name, 'TEST/discard', "got back metric name");
      t.equal(tag.scope, '', "didn't get back a scope");

      t.ok(mapping[1] > 1, "Got back a numeric ID to map to");
      t.doesNotThrow(function () {
        agent.mapper.load(response);
      }, "was able to load mapping");

      t.end();
    });
  });
});
