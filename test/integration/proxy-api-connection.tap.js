'use strict';

var path         = require('path')
  , http         = require('http')
  , test         = require('tap').test
  , fmt          = require('util').format
  , setup        = require('proxy')
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  , CollectorAPI = require(path.join(__dirname, '..', '..', 'lib', 'collector', 'api.js'))
  ;

test("setting proxy_port should use the proxy agent", function (t) {
  var server = setup(http.createServer());
  var port   = 0;

  server.listen(port, function () {
    port = server.address().port;

    var config = configurator.initialize({
          'app_name'    : 'node.js Tests',
          'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
          'host'        : 'staging-collector.newrelic.com',
          'port'        : 443,
          'proxy_port'  : port,
          'ssl'         : true,
          'logging'     : {
            'level' : 'trace'
          },
          'feature_flag': {
            // FLAG: proxy
            proxy: true
          }
        })
      , agent = new Agent(config)
      , api   = new CollectorAPI(agent)
      ;

    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error");
      t.ok(returned, "got boot configuration");
      t.ok(returned.agent_run_id, "got run ID");
      t.ok(agent.config.run_id, "run ID set in configuration");

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue");
        t.equal(returned, null, "collector explicitly returns null");
        t.deepEqual(json, {return_value : null}, "raw message looks right");
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown");

        server.close();
        t.end();
      });
    });
  });

});

test("proxy agent with SSL tunnel to collector", function (t) {
  var server = setup(http.createServer());
  var port   = 0;

  server.listen(port, function () {
    port = server.address().port;

    var config = configurator.initialize({
          'app_name'    : 'node.js Tests',
          'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
          'host'        : 'staging-collector.newrelic.com',
          'port'        : 443,
          'proxy'       : fmt('http://localhost:%d', port),
          'ssl'         : true,
          'logging'     : {
            'level' : 'trace'
          },
          'feature_flag': {
            // FLAG: proxy
            proxy: true
          }
        })
      , agent = new Agent(config)
      , api   = new CollectorAPI(agent)
      ;

    api.connect(function cb_connect(error, returned) {
      t.notOk(error, "connected without error");
      t.ok(returned, "got boot configuration");
      t.ok(returned.agent_run_id, "got run ID");
      t.ok(agent.config.run_id, "run ID set in configuration");

      api.shutdown(function cb_shutdown(error, returned, json) {
        t.notOk(error, "should have shut down without issue");
        t.equal(returned, null, "collector explicitly returns null");
        t.deepEqual(json, {return_value : null}, "raw message looks right");
        t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown");

        server.close();
        t.end();
      });
    });
  });

});

test("proxy agent with plain http to collector", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 80,
        'ssl'         : false,
        'logging'     : {
          'level' : 'trace'
        },
        'feature_flag': {
          // FLAG: proxy
          proxy: true
        }
      })
    , agent = new Agent(config)
    , api   = new CollectorAPI(agent)
    ;

  api.connect(function cb_connect(error, returned) {
    t.notOk(error, "connected without error");
    t.ok(returned, "got boot configuration");
    t.ok(returned.agent_run_id, "got run ID");
    t.ok(agent.config.run_id, "run ID set in configuration");

    api.shutdown(function cb_shutdown(error, returned, json) {
      t.notOk(error, "should have shut down without issue");
      t.equal(returned, null, "collector explicitly returns null");
      t.deepEqual(json, {return_value : null}, "raw message looks right");
      t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown");

      t.end();
    });
  });
});

test("no proxy set should not use proxy agent", function (t) {
  var config = configurator.initialize({
        'app_name'    : 'node.js Tests',
        'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
        'host'        : 'staging-collector.newrelic.com',
        'port'        : 443,
        'ssl'         : true,
        'logging'     : {
          'level' : 'trace'
        },
        'feature_flag': {
          // FLAG: proxy
          proxy: true
        }
      })
    , agent = new Agent(config)
    , api   = new CollectorAPI(agent)
    ;

  api.connect(function cb_connect(error, returned) {
    t.notOk(error, "connected without error");
    t.ok(returned, "got boot configuration");
    t.ok(returned.agent_run_id, "got run ID");
    t.ok(agent.config.run_id, "run ID set in configuration");

    api.shutdown(function cb_shutdown(error, returned, json) {
      t.notOk(error, "should have shut down without issue");
      t.equal(returned, null, "collector explicitly returns null");
      t.deepEqual(json, {return_value : null}, "raw message looks right");
      t.notOk(agent.config.run_id, "run ID should have been cleared by shutdown");

      t.end();
    });
  });
});
