'use strict';

var path   = require('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("Redis instrumentation should find Redis calls in the transaction trace",
     {timeout : 5000},
     function (t) {
  t.plan(17);

  var self = this;
  helper.bootstrapRedis(function (error, app) {
    if (error) return t.fail(error);

    var agent  = helper.instrumentMockedAgent()
      , redis  = require('redis')
      , client = redis.createClient()
      ;

    self.tearDown(function () {
      helper.cleanRedis(app, function done() {
        helper.unloadAgent(agent);
      });
    });

    // need to capture parameters
    agent.config.capture_params = true;

    t.notOk(agent.getTransaction(), "no transaction should be in play");

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction();
      t.ok(transaction, "transaction should be visible");

      client.set('testkey', 'arglbargle', function (error, ok) {
        if (error) return t.fail(error);

        t.ok(agent.getTransaction(), "transaction should still be visible");
        t.ok(ok, "everything should be peachy after setting");

        client.get('testkey', function (error, value) {
          if (error) return t.fail(error);

          t.ok(agent.getTransaction(), "transaction should still still be visible");
          t.equals(value, 'arglbargle', "memcached client should still work");

          transaction.end();

          var trace = transaction.getTrace();
          t.ok(trace, "trace should exist");
          t.ok(trace.root, "root element should exist");
          t.equals(trace.root.children.length, 1,
                   "there should be only one child of the root");

          var setSegment = trace.root.children[0];
          t.ok(setSegment, "trace segment for set should exist");
          t.equals(setSegment.name, "Datastore/operation/Redis/set",
                   "should register the set");
          t.equals(setSegment.parameters.key, "[\"testkey\"]",
                   "should have the set key as a parameter");
          t.equals(setSegment.children.length, 1,
                   "set should have an only child");

          var getSegment = setSegment.children[0];
          t.ok(getSegment, "trace segment for get should exist");
          t.equals(getSegment.name, "Datastore/operation/Redis/get",
                   "should register the get");
          t.equals(getSegment.parameters.key, "[\"testkey\"]",
                   "should have the get key as a parameter");
          t.equals(getSegment.children.length, 0,
                   "get should leave us here at the end");

          client.end();
        });
      });
    });
  });
});
