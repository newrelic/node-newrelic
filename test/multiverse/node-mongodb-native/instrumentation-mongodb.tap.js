'use strict';

var path   = require('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

function ender(t, db, agent) {
  db.close(true, function (error) {
    if (error) t.fail(error);

    helper.unloadAgent(agent);
  });
}

function getDB() {
  var mongodb = require('mongodb')
    , server  = new mongodb.Server('localhost', 27017, {auto_reconnect : true})
    ;

  return new mongodb.Db('integration', server, {safe : true});
}

// +4 tests
function addVerifier(t, agent, operation) {
  agent.once('transactionFinished', function () {
    t.equals(agent.metrics.getMetric('Database/all').stats.callCount, 1,
             "should find all operations");
    t.equals(agent.metrics.getMetric('Database/' + operation).stats.callCount, 1,
             "basic " + operation + "should be recorded");
    t.equals(agent.metrics.getMetric('Database/test/' + operation).stats.callCount, 1,
             "named collection " + operation + " should be recorded");
    t.equals(agent.metrics.getMetric('Database/test/' + operation,
                                     'MongoDB/test/' + operation).stats.callCount, 1,
             "scoped MongoDB request should be recorded");
  });
}

function runInTestCollection(context, t, callback) {
  var agent = helper.instrumentMockedAgent()
    , db    = getDB()
    ;

  context.tearDown(ender.bind(null, t, db, agent));

  db.open(function (error, db) {
    if (error) { t.fail(error); return t.end(); }

    db.createCollection('test', {safe : true}, function (error, collection) {
      if (error) { t.fail(error); return t.end(); }

      helper.runInTransaction(agent, callback.bind(context, agent, collection));
    });
  });
}

test("agent instrumentation of node-mongodb-native", function (t) {
  t.plan(3);

  var toplevel = this;
  helper.bootstrapMongoDB(function (error, app) {
    if (error) return t.fail(error);

    toplevel.tearDown(helper.cleanMongoDB.bind(helper, app));

    t.test("insert", function (t) {
      t.plan(1);

      t.test("inside transaction", function (t) {
        t.plan(1);

        t.test("with callback", function (t) {
          t.plan(11);

          runInTestCollection(this, t, function (agent, collection) {
            var transaction = agent.getTransaction()
              , hunx        = {id : 1, hamchunx : "verbloks"}
              ;

            addVerifier(t, agent, 'insert');

            collection.insert(hunx, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist.");
              t.ok(trace.root, "root element should exist.");
              t.equals(trace.root.children.length, 1, "should be only one child.");

              var segment = trace.root.children[0];
              t.ok(segment, "trace segment for insert should exist");
              t.equals(segment.name, 'MongoDB/test/insert', "should register the insert");
            });
          });
        });
      });
    });

    t.test("find", function (t) {
      t.plan(1);

      t.test("inside transaction", function (t) {
        t.plan(1);

        t.test("with callback", function (t) {
          t.plan(11);

          runInTestCollection(this, t, function (agent, collection) {
            var transaction = agent.getTransaction();

            addVerifier(t, agent, 'find');

            collection.find({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist.");
              t.ok(trace.root, "root element should exist.");
              t.equals(trace.root.children.length, 1, "should be only one child.");

              var segment = trace.root.children[0];
              t.ok(segment, "trace segment for find should exist");
              t.equals(segment.name, 'MongoDB/test/find', "should register the find");
            });
          });
        });
      });
    });

    t.test("findOne", function (t) {
      t.plan(1);

      t.test("inside transaction", function (t) {
        t.plan(1);

        t.test("with callback", function (t) {
          t.plan(11);

          runInTestCollection(this, t, function (agent, collection) {
            var transaction = agent.getTransaction();

            addVerifier(t, agent, 'find');

            collection.findOne({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(result, "shouldn't have gotten back nonexistent result");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist.");
              t.ok(trace.root, "root element should exist.");
              t.equals(trace.root.children.length, 1, "should be only one child.");

              var segment = trace.root.children[0];
              t.ok(segment, "trace segment for find should exist");
              t.equals(segment.name, 'MongoDB/test/find', "should register the find");

              t.end();
            });
          });
        });
      });
    });
  });
});
