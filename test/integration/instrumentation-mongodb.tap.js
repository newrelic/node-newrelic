'use strict';

var path    = require('path')
  , tap     = require('tap')
  , test    = tap.test
  , shimmer = require(path.join(__dirname, '..', '..', 'lib', 'shimmer'))
  , helper  = require(path.join(__dirname, '..', 'lib', 'agent_helper'))
  ;

test("MongoDB instrumentation should find the MongoDB call in the transaction trace",
     {timeout : 5000},
     function (t) {
  t.plan(7);

  var self = this;
  helper.bootstrapMongoDB(function (error, app) {
    if (error) return t.fail(error);

    var agent = helper.loadMockedAgent();
    shimmer.bootstrapInstrumentation(agent);
    var mongodb = require('mongodb');

    var server = new mongodb.Server('localhost', 27017, {auto_reconnect : true});
    var db = new mongodb.Db('integration', server);

    self.tearDown(function () {
      db.close(true, function (error, result) {
        if (error) t.fail(error);

        helper.cleanMongoDB(app, function done() {
          helper.unloadAgent(agent);
        });
      });
    });

    db.open(function (error, db) {
      if (error) return t.fail(error);

      db.createCollection('test', {safe : true}, function (error, collection) {
        if (error) return t.fail(error);
        t.notOk(agent.getTransaction(), "no transaction should be in play yet.");

        var wrapped = agent.tracer.transactionProxy(function transactionInScope() {
          var transaction = agent.getTransaction();
          t.ok(transaction, "transaction should be visible.");

          var hunx = {id : 1, hamchunx : "verbloks"};
          collection.insert(hunx, function (error, result) {
            if (error) return t.fail(error);

            collection.findOne({id : 1}, function (error, item) {
              t.deepEquals(item, hunx, "MongoDB should still work.");

              transaction.end();
              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist.");
              t.ok(trace.root, "root element should exist.");
              t.equals(trace.root.children.length, 1, "There should be only one child.");
              t.equals(trace.root.children[0].name, "Mongodb/insert", "should see the insert");

              t.end();
            });
          });
        });
        wrapped();
      });
    });
  });
});
