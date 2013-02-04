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

// +4 asserts
function addMetricsVerifier(t, agent, operation) {
  agent.once('transactionFinished', function () {
    t.equals(agent.metrics.getMetric('Database/all').stats.callCount, 1,
             "should find all operations");
    t.equals(agent.metrics.getMetric('Database/' + operation).stats.callCount, 1,
             "generic " + operation + " should be recorded");
    t.equals(agent.metrics.getMetric('Database/test/' + operation).stats.callCount, 1,
             "named collection " + operation + " should be recorded");
    t.equals(agent.metrics.getMetric('Database/test/' + operation,
                                     'MongoDB/test/' + operation).stats.callCount, 1,
             "scoped MongoDB request should be recorded");
  });
}

// +5 asserts
function verifyTrace(t, transaction, operation) {
  var trace = transaction.getTrace();
  t.ok(trace, "trace should exist.");
  t.ok(trace.root, "root element should exist.");
  t.equals(trace.root.children.length, 1,
           "should be only one child.");

  var segment = trace.root.children[0];
  t.ok(segment, "trace segment for " + operation + " should exist");
  t.equals(segment.name, 'MongoDB/test/' + operation,
           "should register the " + operation);
}

function verifyNoStats(t, agent, operation) {
  t.notOk(agent.metrics.getMetric('Database/all'),
          "should find no operations");
  t.notOk(agent.metrics.getMetric('Database/' + operation),
          "generic " + operation + " should not be recorded");
  t.notOk(agent.metrics.getMetric('Database/test/' + operation),
          "named collection " + operation + " should not be recorded");
  t.notOk(agent.metrics.getMetric('Database/test/' + operation,
                                  'MongoDB/test/' + operation),
           "scoped MongoDB request should not be recorded");
}

function runWithoutTransaction(context, t, callback) {
  var agent = helper.instrumentMockedAgent()
    , db    = getDB()
    ;

  context.tearDown(ender.bind(null, t, db, agent));

  db.open(function (error, db) {
    if (error) { t.fail(error); return t.end(); }

    db.createCollection('test', {safe : false}, function (error, collection) {
      if (error) { t.fail(error); return t.end(); }

      callback.call(context, agent, collection);
    });
  });
}

function runWithTransaction(context, t, callback) {
  runWithoutTransaction(context, t, function (agent, collection) {
    helper.runInTransaction(agent, callback.bind(context, agent, collection));
  });
}

test("agent instrumentation of node-mongodb-native", function (t) {
  t.plan(3);

  var toplevel = this;
  helper.bootstrapMongoDB(function (error, app) {
    if (error) return t.fail(error);

    toplevel.tearDown(helper.cleanMongoDB.bind(helper, app));

    t.test("insert", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(11);

          runWithTransaction(this, t, function (agent, collection) {
            var transaction = agent.getTransaction()
              , hunx        = {id : 1, hamchunx : "verbloks"}
              ;

            addMetricsVerifier(t, agent, 'insert');

            collection.insert(hunx, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'insert');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : 5000}, function (t) {
          t.plan(9);

          runWithTransaction(this, t, function (agent, collection) {
            var transaction = agent.getTransaction()
              , hanx        = {id : 2, feeblers : "gerhungorst"}
              ;

            addMetricsVerifier(t, agent, 'insert');

            collection.insert(hanx);

            setTimeout(function () {
              transaction.end();

              verifyTrace(t, transaction, 'insert');
            }, 100);
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(6);

          runWithoutTransaction(this, t, function (agent, collection) {
            var hunx = {id : 3, hamchunx : "caramel"};

            collection.insert(hunx, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");
              t.notOk(agent.getTransaction(), "should be not transaction in play");

              setTimeout(function () {
                verifyNoStats(t, agent, 'insert');
              }, 100);
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : 5000}, function (t) {
          t.plan(4);

          runWithoutTransaction(this, t, function (agent, collection) {
            var hanx = {id : 4, feeblers : "charimanley"};

            collection.insert(hanx);

            setTimeout(function () {
              verifyNoStats(t, agent, 'insert');
            }, 100);
          });
        });
      });
    });

    t.test("find", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(11);

          runWithTransaction(this, t, function (agent, collection) {
            var transaction = agent.getTransaction();

            addMetricsVerifier(t, agent, 'find');

            collection.find({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'find');
            });
          });
        });

        t.test("with Cursor", function (t) {
          t.plan(11);

          runWithTransaction(this, t, function (agent, collection) {
            var transaction = agent.getTransaction();

            addMetricsVerifier(t, agent, 'find');

            var cursor = collection.find({id : 1337});
            cursor.toArray(function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'find');
            });
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(6);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.find({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");
              t.notOk(agent.getTransaction(), "should be no transaction");

              setTimeout(function () {
                verifyNoStats(t, agent, 'find');
              }, 100);
            });
          });
        });

        t.test("with Cursor", function (t) {
          t.plan(6);

          runWithoutTransaction(this, t, function (agent, collection) {
            var cursor = collection.find({id : 1337});
            cursor.toArray(function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");
              t.notOk(agent.getTransaction(), "should be no transaction");

              setTimeout(function () {
                verifyNoStats(t, agent, 'find');
              }, 100);
            });
          });
        });
      });
    });

    t.test("findOne", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(11);

          runWithTransaction(this, t, function (agent, collection) {
            var transaction = agent.getTransaction();

            addMetricsVerifier(t, agent, 'find');

            collection.findOne({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(result, "shouldn't have gotten back nonexistent result");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'find');
            });
          });
        });

        // findOne doesn't do anything useful without a callback
        t.test("findOne requires a callback", function (t) { t.end(); });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", function (t) {
          t.plan(6);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.findOne({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(result, "shouldn't have gotten back nonexistent result");
              t.notOk(agent.getTransaction(), "should be no transaction");

              setTimeout(function () {
                verifyNoStats(t, agent, 'find');
              }, 100);
            });
          });
        });

        // findOne doesn't do anything useful without a callback
        t.test("findOne requires a callback", function (t) { t.end(); });
      });
    });
  });
});
