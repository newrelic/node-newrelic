'use strict';

var path     = require('path')
  , trycatch = require('trycatch')
  , test     = require('tap').test
  , helper   = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

/*
 *
 * CONSTANTS
 *
 */

// centrally control how long we're willing to wait for mongo
var SLUG_FACTOR = 30000;

// +5 asserts
function addMetricsVerifier(t, agent, operation) {
  agent.once('transactionFinished', function () {
    try {
      t.equals(
        agent.metrics.getMetric('Datastore/all').callCount,
        1,
        "should find all operations"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/allOther').callCount,
        1,
        "should find all operations"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/operation/MongoDB/' + operation).callCount,
        1,
        "generic " + operation + " should be recorded"
      );
      t.equals(
       agent.metrics.getMetric('Datastore/statement/MongoDB/test/' + operation).callCount,
       1,
       "named collection " + operation + " should be recorded"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/instance/MongoDB/localhost:27017').callCount,
        1,
        "should find all calls to the local instance"
      );
    }
    catch (error) {
      t.fail(error);
      t.end();
    }
  });
}

// +7 asserts
function addMetricsVerifierNoCallback(t, agent, operation, verifier) {
  agent.once('transactionFinished', function () {
    try {
      t.equals(
        agent.metrics.getMetric('Datastore/all').callCount,
        2,
        "should find all operations"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/allOther').callCount,
        2,
        "should find all operations"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/operation/MongoDB/' + operation).callCount,
        1,
        "generic " + operation + " should be recorded"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/operation/MongoDB/' + verifier).callCount,
        1,
        "generic " + verifier + " should be recorded"
      );
      t.equals(
       agent.metrics.getMetric('Datastore/statement/MongoDB/test/' + operation).callCount,
       1,
       "MongoDB " + operation + " should be recorded"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/statement/MongoDB/test/' + verifier).callCount,
        1,
        "MongoDB " + verifier + " should be recorded"
      );
      t.equals(
        agent.metrics.getMetric('Datastore/instance/MongoDB/localhost:27017').callCount,
        2,
        "should find all calls to the local instance"
      );
    }
    catch (error) {
      t.fail(error);
      t.end();
    }
  });
}

// +6 asserts
function verifyTrace(t, transaction, operation) {
  try {
    var trace = transaction.getTrace();
    t.ok(trace, "trace should exist.");
    t.ok(trace.root, "root element should exist.");
    t.equals(trace.root.children.length, 1, "should be only one child.");

    var segment = trace.root.children[0];
    t.ok(segment, "trace segment for " + operation + " should exist");
    t.equals(segment.name, 'Datastore/statement/MongoDB/test/' + operation,
             "should register the " + operation);
    t.equals(segment.children.length, 0, "should have no children");
  }
  catch (error) {
    t.fail(error);
    t.end();
  }
}

// +9 asserts
function verifyTraceNoCallback(t, transaction, operation, verifier) {
  try {
    var trace = transaction.getTrace();
    t.ok(trace, "trace should exist.");
    t.ok(trace.root, "root element should exist.");
    t.equals(trace.root.children.length, 2, "should be two children.");

    var segment = trace.root.children[0];
    t.ok(segment, "trace segment for " + operation + " should exist");
    t.equals(segment.name, 'Datastore/statement/MongoDB/test/' + operation,
             "should register the " + operation);
    t.equals(segment.children.length, 0, "should have no children");

    segment = trace.root.children[1];
    t.ok(segment, "trace segment for " + verifier + " should exist");
    t.equals(segment.name, 'Datastore/statement/MongoDB/test/' + verifier,
             "should register the " + verifier);
    t.equals(segment.children.length, 0, "should have no children");
  }
  catch (error) {
    t.fail(error);
    t.end();
  }
}

// +5 asserts
function verifyNoStats(t, agent, operation) {
  try {
    t.notOk(agent.metrics.getMetric('Datastore/all'),
            "should find no operations");
    t.notOk(agent.metrics.getMetric('Datastore/allOther'),
            "should find no other operations");
    t.notOk(agent.metrics.getMetric('Datastore/operation/MongoDB/' + operation),
            "generic " + operation + " should not be recorded");
    t.notOk(agent.metrics.getMetric('Datastore/statement/MongoDB/test/' + operation),
             "MongoDB " + operation + " should not be recorded");
    t.notOk(agent.metrics.getMetric('Datastore/instance/MongoDB/localhost:27017'),
             "should find no calls to the local instance"
    );
  }
  catch (error) {
    t.fail(error);
    t.end();
  }
}

function runWithDB(context, t, callback) {
  var mongodb = require('mongodb')
    , server  = new mongodb.Server('localhost', 27017, {auto_reconnect : true})
    , db      = mongodb.Db('integration', server, {safe : true})
    ;

  context.tearDown(function () {
    db.close(true, function (error) {
      if (error) t.fail(error);
    });
  });

  // <3 CrabDude and creationix
  trycatch(
    function () {
      db.open(function (error, db) {
        if (error) { t.fail(error); return t.end(); }

        db.createCollection('test', {safe : false}, function (error, collection) {
          if (error) { t.fail(error); return t.end(); }

          callback.call(context, collection);
        });
      });
    },
    function (error) {
      t.fail(error);
      t.end();
    }
  );
}

function runWithoutTransaction(context, t, callback) {
  // need an agent before connecting to MongoDB so the module loader gets patched
  var agent = helper.instrumentMockedAgent();
  runWithDB(context, t, function (collection) {
    context.tearDown(helper.unloadAgent.bind(null, agent));
    callback.call(context, agent, collection);
  });
}

function runWithTransaction(context, t, callback) {
  runWithoutTransaction(context, t, function (agent, collection) {
    helper.runInTransaction(agent, function (transaction) {
      callback.call(context, agent, collection, transaction);
    });
  });
}

test("agent instrumentation of node-mongodb-native", function (t) {
  t.plan(15);

  var toplevel = this;
  helper.bootstrapMongoDB(function (error, app) {
    if (error) return t.fail(error);

    toplevel.tearDown(helper.cleanMongoDB.bind(helper, app));

    t.test("insert", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'insert');

            var hunx = {id : 1, hamchunx : "verbloks"};
            collection.insert(hunx, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.ok(result, "should have gotten back results");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'insert');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(11);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'insert');

            var hanx = {id : 2, feeblers : "gerhungorst"};
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

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

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

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(5);

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

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
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

        t.test("with Cursor", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
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

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

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

        t.test("with Cursor", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

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

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'findOne');

            collection.findOne({id : 1337}, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(result, "shouldn't have gotten back nonexistent result");

              t.ok(agent.getTransaction(), "transaction should still be visible");

              transaction.end();

              verifyTrace(t, transaction, 'findOne');
            });
          });
        });

        t.comment("findOne requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

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

        t.comment("findOne requires a callback");
      });
    });

    t.test("findAndModify", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(14);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'findAndModify');

            collection.findAndModify({feeblers : {$exists : true}},
                                     [['id', 1]],
                                     {$set : {__findAndModify : true}},
                                     {"new" : true},
                                     function (error, doc) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.ok(doc, "should have gotten back the modified document");
              t.ok(doc.__findAndModify, "have evidence of modification");

              transaction.end();

              verifyTrace(t, transaction, 'findAndModify');
            });
          });
        });

        t.comment("findAndModify requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(8);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.findAndModify({hamchunx : {$exists : true}},
                                     [['id', 1]],
                                     {$set : {__findAndModify : true}},
                                     {"new" : true},
                                     function (error, doc) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should be no transaction");

              t.ok(doc, "should have gotten back the modified document");
              t.ok(doc.__findAndModify, "have evidence of modification");

              verifyNoStats(t, agent, 'findAndModify');
            });
          });
        });

        t.comment("findAndModify requires a callback");
      });
    });

    t.test("findAndRemove", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(14);

          var current = this;
          runWithDB(current, t, function (collection) {
            var it0rm = {id : 876, bornToDie : 'young'};
            collection.insert(it0rm, function (error) {
              if (error) { t.fail(error); return t.end(); }

              runWithTransaction(current, t, function (agent, collection, transaction) {
                addMetricsVerifier(t, agent, 'findAndRemove');

                collection.findAndRemove({bornToDie : {$exists : true}},
                                         [['id', 1]],
                                         function (error, doc) {
                  if (error) { t.fail(error); return t.end(); }

                  t.ok(agent.getTransaction(), "transaction should still be visible");

                  t.ok(doc, "should have gotten back the removed document");
                  t.equal(doc.id, 876, "should have evidence of removal");

                  transaction.end();

                  verifyTrace(t, transaction, 'findAndRemove');
                });
              });
            });
          });
        });

        t.comment("findAndRemove requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(8);

          var current = this;
          runWithDB(current, t, function (collection) {
            var it0rm = {id : 987, bornToDie : 'young'};
            collection.insert(it0rm, function (error) {
              if (error) { t.fail(error); return t.end(); }

              runWithoutTransaction(current, t, function (agent, collection) {
                collection.findAndRemove({bornToDie : {$exists : true}},
                                         [['id', 1]],
                                         function (error, doc) {
                  if (error) { t.fail(error); return t.end(); }
                  t.notOk(agent.getTransaction(), "should have no transaction");

                  t.ok(doc, "should have gotten back the removed document");
                  t.equal(doc.id, 987, "should have evidence of removal");

                  verifyNoStats(t, agent, 'findAndRemove');
                });
              });
            });
          });
        });

        t.comment("findAndRemove requires a callback");
      });
    });

    t.test("update", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'update');

            collection.update({feeblers : {$exists : true}},
                              {$set : {__updatedWith : 'yup'}},
                              {safe : true, multi : true},
                              function (error, numberModified) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(numberModified, 2, "should have modified 2 documents");

              transaction.end();

              verifyTrace(t, transaction, 'update');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(21);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifierNoCallback(t, agent, 'update', 'find');

            collection.update({feeblers : {$exists : true}},
                              {$set : {__updatedWith : 'yup'}});

            setTimeout(function () {
              collection.find({__updatedWith : 'yup'}).toArray(function (error, docs) {
                if (error) { t.fail(error); return t.end(); }

                t.ok(agent.getTransaction(), "transaction should still be visible");

                t.ok(docs, "should have gotten back results");
                t.equal(docs.length, 2, "should have found 2 modified");
                docs.forEach(function (doc) {
                  t.ok(doc.feeblers, "expected value found");
                });

                transaction.end();

                verifyTraceNoCallback(t, transaction, 'update', 'find');
              });
            }, 100);
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.update({hamchunx : {$exists : true}},
                              {$set : {__updatedWithout : 'yup'}},
                              {safe : true, multi : true},
                              function (error, numberModified) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should be no transaction");

              t.equal(numberModified, 2, "should have modified 2 documents");

              verifyNoStats(t, agent, 'update');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(10);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.update({hamchunx : {$exists : true}},
                              {$set : {__updatedWithout : 'yup'}});

            setTimeout(function () {
              collection.find({__updatedWithout : 'yup'}).toArray(function (error, docs) {
                if (error) { t.fail(error); return t.end(); }
                t.notOk(agent.getTransaction(), "should be no transaction");

                t.ok(docs, "should have gotten back results");
                t.equal(docs.length, 2, "should have found 2 modified");
                docs.forEach(function (doc) {
                  t.ok(doc.hamchunx, "expected value found");
                });

                verifyNoStats(t, agent, 'update');
              });
            }, 100);
          });
        });
      });
    });

    t.test("save", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(15);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'save');

            var saved = {id : 999, oneoff : 'broccoli', __saved : true};
            collection.save(saved, function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.ok(result, "should have the saved document");
              t.ok(result._id, "should have evidence that it saved");
              t.ok(result.__saved, "should have evidence we got our original document");

              transaction.end();

              verifyTrace(t, transaction, 'save');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(19);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifierNoCallback(t, agent, 'save', 'find');

            var saved = {id : 555, oneoff : 'radishes', __saved : true};
            collection.save(saved);

            setTimeout(function () {
              collection.find({oneoff : 'radishes'}).toArray(function (error, docs) {
                if (error) { t.fail(error); return t.end(); }

                t.ok(agent.getTransaction(), "transaction should still be visible");

                t.equal(docs.length, 1, "should have only found one document");
                t.equal(docs[0].id, 555, "should have evidence it's the same document");

                transaction.end();

                verifyTraceNoCallback(t, transaction, 'save', 'find');
              });
            }, 100);
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(9);

          runWithoutTransaction(this, t, function (agent, collection) {
            var saved = {id : 888, oneoff : 'daikon', __saved : true};
            collection.save(saved, function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.ok(result, "should have the saved document");
              t.ok(result._id, "should have evidence that it saved");
              t.ok(result.__saved, "should have evidence we got our original document");

              verifyNoStats(t, agent, 'insert');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(8);

          runWithoutTransaction(this, t, function (agent, collection) {
            var saved = {id : 444, oneoff : 'radicchio', __saved : true};
            collection.save(saved);

            setTimeout(function () {
              collection.find({oneoff : 'radishes'}).toArray(function (error, docs) {
                if (error) { t.fail(error); return t.end(); }
                t.notOk(agent.getTransaction(), "should be no transaction");

                t.equal(docs.length, 1, "should have only found one document");
                t.equal(docs[0].id, 555, "should have evidence it's the same document");

                verifyNoStats(t, agent, 'insert');
              });
            }, 100);
          });
        });
      });
    });

    t.test("count", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'count');

            collection.count(function (error, count) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(count, 8, "should have found 8 documents");

              transaction.end();

              verifyTrace(t, transaction, 'count');
            });
          });
        });

        t.comment("count requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.count(function (error, count) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(count, 8, "should have found 8 documents");

              verifyNoStats(t, agent, 'count');
            });
          });
        });

        t.comment("count requires a callback");
      });
    });

    t.test("distinct", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'distinct');

            collection.distinct('id', function (error, distinctSet) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(distinctSet.length, 8, "should have found 8 documents");

              transaction.end();

              verifyTrace(t, transaction, 'distinct');
            });
          });
        });

        t.comment("distinct requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.distinct('id', function (error, distinctSet) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(distinctSet.length, 8, "should have found 8 documents");

              verifyNoStats(t, agent, 'distinct');
            });
          });
        });

        t.comment("distinct requires a callback");
      });
    });

    t.test("createIndex", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'createIndex');

            collection.createIndex('id', function (error, name) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(name, 'id_1', "should have created an index");

              transaction.end();

              verifyTrace(t, transaction, 'createIndex');
            });
          });
        });

        t.comment("createIndex requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.createIndex('id', function (error, name) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(name, 'id_1', "should have created another index");

              verifyNoStats(t, agent, 'createIndex');
            });
          });
        });

        t.comment("createIndex requires a callback");
      });
    });

    t.test("ensureIndex", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'ensureIndex');

            collection.ensureIndex('id', function (error, name) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(name, 'id_1', "should have found an index");

              transaction.end();

              verifyTrace(t, transaction, 'ensureIndex');
            });
          });
        });

        t.comment("ensureIndex requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.ensureIndex('id', function (error, name) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(name, 'id_1', "should have created another index");

              verifyNoStats(t, agent, 'ensureIndex');
            });
          });
        });

        t.comment("ensureIndex requires a callback");
      });
    });

    t.test("reIndex", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'reIndex');

            collection.reIndex(function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(result, true, "should have found an index");

              transaction.end();

              verifyTrace(t, transaction, 'reIndex');
            });
          });
        });

        t.comment("reIndex requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.reIndex(function (error, result) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(result, true, "should have created another index");

              verifyNoStats(t, agent, 'reIndex');
            });
          });
        });

        t.comment("reIndex requires a callback");
      });
    });

    t.test("dropIndex", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'dropIndex');

            collection.dropIndex('id_1', function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(result.nIndexesWas, 2, "should have dropped an index");

              transaction.end();

              verifyTrace(t, transaction, 'dropIndex');
            });
          });
        });

        t.comment("dropIndex requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.dropIndex('id_1', function (error) {
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(error.message, 'index not found',
                      "shouldn't have found index to drop");

              verifyNoStats(t, agent, 'dropIndex');
            });
          });
        });

        t.comment("dropIndex requires a callback");
      });
    });

    t.test("dropAllIndexes", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'dropAllIndexes');

            collection.dropAllIndexes(function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(result, true, "should have dropped the indexes");

              transaction.end();

              verifyTrace(t, transaction, 'dropAllIndexes');
            });
          });
        });

        t.comment("dropAllIndexes requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.dropAllIndexes(function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(result, true, "should have dropped all those no indexes");

              verifyNoStats(t, agent, 'dropAllIndexes');
            });
          });
        });

        t.comment("dropAllIndexes requires a callback");
      });
    });

    t.test("remove", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 5000}, function (t) {
          t.plan(13);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'remove');

            collection.remove({id : 1}, {w : 1}, function (error, removed) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.equal(removed, 1, "should have removed 1 document from collection");

              transaction.end();

              verifyTrace(t, transaction, 'remove');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(18);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            addMetricsVerifierNoCallback(t, agent, 'remove', 'count');

            collection.remove({id : 2});
            setTimeout(function () {
              collection.count({id : 2}, function (error, nope) {
                if (error) { t.fail(error); return t.end(); }

                t.ok(agent.getTransaction(), "transaction should still be visible");

                t.notOk(nope, "should have removed document with id 2 from collection");

                transaction.end();

                verifyTraceNoCallback(t, transaction, 'remove', 'count');
              });
            });
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 5000}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.remove({id : 3}, {w : 1}, function (error, removed) {
              if (error) { t.fail(error); return t.end(); }
              t.notOk(agent.getTransaction(), "should have no transaction");

              t.equal(removed, 1, "should have removed 1 document from collection");

              verifyNoStats(t, agent, 'remove');
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : SLUG_FACTOR}, function (t) {
          t.plan(7);

          runWithoutTransaction(this, t, function (agent, collection) {
            collection.remove({id : 4});
            setTimeout(function () {
              collection.count({id : 4}, function (error, nope) {
                if (error) { t.fail(error); return t.end(); }
                t.notOk(agent.getTransaction(), "should have no transaction");

                t.notOk(nope, "should have removed document with id 4 from collection");

                verifyNoStats(t, agent, 'remove');
              });
            });
          });
        });
      });
    });
  });
});
