'use strict';

var path   = require('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("memcached instrumentation should find memcached calls in the transaction trace",
     {timeout : 5000},
     function (t) {
  t.plan(29);

  var self = this;
  helper.bootstrapMemcached(function (error, app) {
    if (error) return t.fail(error);

    var agent = helper.instrumentMockedAgent();
    var Memcached = require('memcached');

    var memcached = new Memcached('localhost:11211');

    // need to capture parameters
    agent.config.capture_params = true;

    self.tearDown(function () {
      helper.cleanMemcached(app, function done() {
        helper.unloadAgent(agent);
      });
    });

    t.notOk(agent.getTransaction(), "no transaction should be in play");

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction();
      t.ok(transaction, "transaction should be visible");

      memcached.set('testkey', 'arglbargle', 1000, function (error, ok) {
        if (error) return t.fail(error);

        t.ok(agent.getTransaction(), "transaction should still be visible");
        t.ok(ok, "everything should be peachy after setting");

        memcached.get('testkey', function (error, value) {
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
          t.equals(setSegment.name, "Datastore/operation/Memcache/set",
                   "should register the set");
          t.equals(setSegment.parameters.key, "[\"testkey\"]",
                   "should have the set key as a parameter");
          t.equals(setSegment.children.length, 1,
                   "set should have an only child");

          var getSegment = setSegment.children[0];
          t.ok(getSegment, "trace segment for get should exist");
          t.equals(getSegment.name, "Datastore/operation/Memcache/get",
                   "should register the get");
          t.equals(getSegment.parameters.key, "[\"testkey\"]",
                   "should have the get key as a parameter");
          t.equals(getSegment.children.length, 0,
                   "get should leave us here at the end");
        });
      });
    });

    t.notOk(agent.getTransaction(), "no transaction should be in play");

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction();

      memcached.set('otherkey', 'blerg', 1000, function (error, ok) {
        if (error) return t.fail(error);

        t.ok(ok, "everything should still be peachy after setting again");

        memcached.getMulti(['testkey', 'otherkey'], function (error, values) {
          if (error) return t.fail(error);

          t.deepEquals(values, {testkey : 'arglbargle', otherkey : 'blerg'},
                       "memcached client should still work");

          transaction.end();

          var trace = transaction.getTrace();
          t.ok(trace, "trace should exist");
          t.ok(trace.root, "root element should exist");
          t.equals(trace.root.children.length, 1,
                   "there should be only one child of the root");

          var setSegment = trace.root.children[0];
          t.equals(setSegment.name, "Datastore/operation/Memcache/set",
                   "should register the set");
          t.equals(setSegment.parameters.key, "[\"otherkey\"]",
                   "should have the set key as a parameter");
          t.equals(setSegment.children.length, 1,
                   "set should have an only child");

          var getSegment = setSegment.children[0];
          t.equals(getSegment.name, "Datastore/operation/Memcache/get",
                   "should register the get");
          t.equals(getSegment.parameters.key, "[[\"testkey\",\"otherkey\"]]",
                   "should have the multiple keys fetched as a parameter");
          t.equals(getSegment.children.length, 0,
                   "get should leave us here at the end");
        });
      });
    });
  });
});
