'use strict';

var path     = require('path')
  , trycatch = require('trycatch')
  , test     = require('tap').test
  , helper   = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

// +5 asserts
function addMetricsVerifier(t, agent, operation) {
  agent.once('transactionFinished', function () {
    try {
      t.equals(agent.metrics.getMetric('Database/all').callCount, 1,
               "should find all operations");
      t.equals(agent.metrics.getMetric('Database/allOther').callCount, 1,
               "should find all operations");
      t.equals(agent.metrics.getMetric('Database/' + operation).callCount, 1,
               "generic " + operation + " should be recorded");
      t.equals(agent.metrics.getMetric('Database/test/' + operation).callCount, 1,
               "named collection " + operation + " should be recorded");
      t.equals(agent.metrics.getMetric('MongoDB/test/' + operation).callCount, 1,
               "MongoDB " + operation + " should be recorded");
    }
    catch (error) {
      t.fail(error);
      t.end();
    }
  });
}

// +5 asserts
function verifyTrace(t, transaction, operation) {
  try {
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
  catch (error) {
    t.fail(error);
    t.end();
  }
}

// +5 asserts
function verifyNoStats(t, agent, operation) {
  try {
    t.notOk(agent.metrics.getMetric('Database/all'),
            "should find no operations");
    t.notOk(agent.metrics.getMetric('Database/allOther'),
            "should find no other operations");
    t.notOk(agent.metrics.getMetric('Database/' + operation),
            "generic " + operation + " should not be recorded");
    t.notOk(agent.metrics.getMetric('Database/test/' + operation),
            "named collection " + operation + " should not be recorded");
    t.notOk(agent.metrics.getMetric('Database/test/' + operation),
             "MongoDB " + operation + " should not be recorded");
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
  t.plan(9);

  var toplevel = this;
  helper.bootstrapMongoDB(function (error, app) {
    if (error) return t.fail(error);

    toplevel.tearDown(helper.cleanMongoDB.bind(helper, app));

    t.test("insert", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(12);

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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
          t.plan(10);

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

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(12);

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

        t.test("with Cursor", {timeout : 1000}, function (t) {
          t.plan(12);

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

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with Cursor", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(12);

          runWithTransaction(this, t, function (agent, collection, transaction) {
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

        t.comment("findOne requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(13);

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

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(14);

          var current = this;
          runWithDB(current, t, function (collection) {
            var it0rm = {id : 876, bornToDie : 'young'};
            collection.insert(it0rm, function (error) {
              if (error) { t.fail(error); return t.end(); }

              runWithTransaction(current, t, function (agent, collection, transaction) {
                collection.findAndRemove({bornToDie : {$exists : true}},
                                         [['id', 1]],
                                         function (error, doc) {
                  if (error) { t.fail(error); return t.end(); }

                  t.ok(agent.getTransaction(), "transaction should still be visible");

                  t.ok(doc, "should have gotten back the removed document");
                  t.equal(doc.id, 876, "should have evidence of removal");

                  transaction.end();

                  var metrics = agent.metrics;
                  t.equals(metrics.getMetric('Database/all').callCount, 1,
                           "should find all operations");
                  t.equals(metrics.getMetric('Database/allOther').callCount, 1,
                           "should find all operations");
                  t.equals(metrics.getMetric('Database/findAndRemove').callCount, 1,
                           "generic findAndRemove should be recorded");
                  t.equals(metrics.getMetric('Database/test/findAndRemove').callCount, 1,
                           "named collection findAndRemove should be recorded");
                  t.equals(metrics.getMetric('MongoDB/test/findAndRemove').callCount, 1,
                           "MongoDB findAndRemove should be recorded");

                  var trace = transaction.getTrace();
                  t.ok(trace, "trace should exist.");
                  t.ok(trace.root, "root element should exist.");
                  t.equals(trace.root.children.length, 1, "should be one child.");

                  var segment = trace.root.children[0];
                  t.ok(segment, "trace segment for findAndRemove should exist");
                  t.equals(segment.name, 'MongoDB/test/findAndRemove',
                           "should register the findAndRemove");
                  t.equals(segment.children.length, 0,
                           "findAndRemove has no children");
                });
              });
            });
          });
        });

        t.comment("findAndRemove requires a callback");
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 1000}, function (t) {
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

                  verifyNoStats(t, agent, 'remove');
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(12);

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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
          t.plan(20);

          runWithTransaction(this, t, function (agent, collection, transaction) {
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

                t.equals(agent.metrics.getMetric('Database/all').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/allOther').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/update').callCount, 1,
                         "generic update should be recorded");
                t.equals(agent.metrics.getMetric('Database/find').callCount, 1,
                         "generic find should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/update').callCount, 1,
                         "named collection update should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/find').callCount, 1,
                         "named collection find should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/update').callCount, 1,
                         "MongoDB update should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/find').callCount, 1,
                         "MongoDB find should be recorded");

                var trace = transaction.getTrace();
                t.ok(trace, "trace should exist.");
                t.ok(trace.root, "root element should exist.");
                t.equals(trace.root.children.length, 2,
                         "should be two children.");

                var segment = trace.root.children[0];
                t.ok(segment, "trace segment for update should exist");
                t.equals(segment.name, 'MongoDB/test/update',
                         "should register the update");

                segment = trace.root.children[1];
                t.ok(segment, "trace segment for find should exist");
                t.equals(segment.name, 'MongoDB/test/find',
                         "should register the find");
              });
            }, 100);
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(15);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            var saved = {id : 999, oneoff : 'broccoli', __saved : true};
            collection.save(saved, function (error, result) {
              if (error) { t.fail(error); return t.end(); }

              t.ok(agent.getTransaction(), "transaction should still be visible");

              t.ok(result, "should have the saved document");
              t.ok(result._id, "should have evidence that it saved");
              t.ok(result.__saved, "should have evidence we got our original document");

              transaction.end();

              var metrics = agent.metrics;
              t.equals(metrics.getMetric('Database/all').callCount, 1,
                       "should find all operations");
              t.equals(metrics.getMetric('Database/allOther').callCount, 1,
                       "should find all operations");
              t.equals(metrics.getMetric('Database/save').callCount, 1,
                       "generic save should be recorded");
              t.equals(metrics.getMetric('Database/test/save').callCount, 1,
                       "named collection save should be recorded");
              t.equals(metrics.getMetric('MongoDB/test/save').callCount, 1,
                       "MongoDB save should be recorded");

              var trace = transaction.getTrace();
              t.ok(trace, "trace should exist.");
              t.ok(trace.root, "root element should exist.");
              t.equals(trace.root.children.length, 1,
                       "should be one child.");

              var segment = trace.root.children[0];
              t.ok(segment, "trace segment for save should exist");
              t.equals(segment.name, 'MongoDB/test/save',
                       "should register the save");
              t.equals(segment.children.length, 0,
                       "save should have no children");
            });
          });
        });

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
          t.plan(20);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            var saved = {id : 555, oneoff : 'radishes', __saved : true};
            collection.save(saved);

            setTimeout(function () {
              collection.find({oneoff : 'radishes'}).toArray(function (error, docs) {
                if (error) { t.fail(error); return t.end(); }

                t.ok(agent.getTransaction(), "transaction should still be visible");

                t.equal(docs.length, 1, "should have only found one document");
                t.equal(docs[0].id, 555, "should have evidence it's the same document");

                transaction.end();

                t.equals(agent.metrics.getMetric('Database/all').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/allOther').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/save').callCount, 1,
                         "generic save should be recorded");
                t.equals(agent.metrics.getMetric('Database/find').callCount, 1,
                         "generic find should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/save').callCount, 1,
                         "named collection save should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/find').callCount, 1,
                         "named collection find should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/save').callCount, 1,
                         "MongoDB save should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/find').callCount, 1,
                         "MongoDB find should be recorded");

                var trace = transaction.getTrace();
                t.ok(trace, "trace should exist.");
                t.ok(trace.root, "root element should exist.");
                t.equals(trace.root.children.length, 2, "should be two children.");

                var segment = trace.root.children[0];
                t.ok(segment, "trace segment for save should exist");
                t.equals(segment.name, 'MongoDB/test/save', "should register the save");
                t.equals(segment.children.length, 0, "should have no children");

                segment = trace.root.children[1];
                t.ok(segment, "trace segment for find should exist");
                t.equals(segment.name, 'MongoDB/test/find', "should register the find");
                t.equals(segment.children.length, 0, "should have no children");
              });
            }, 100);
          });
        });
      });

      t.test("outside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 1000}, function (t) {
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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
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

        t.test("with callback", {timeout : 1000}, function (t) {
          t.plan(12);

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

        t.test("with callback", {timeout : 1000}, function (t) {
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

    t.test("remove", function (t) {
      t.plan(2);

      t.test("inside transaction", function (t) {
        t.plan(2);

        t.test("with callback", {timeout : 5000}, function (t) {
          t.plan(12);

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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
          t.plan(17);

          runWithTransaction(this, t, function (agent, collection, transaction) {
            collection.remove({id : 2});
            setTimeout(function () {
              collection.count({id : 2}, function (error, nope) {
                if (error) { t.fail(error); return t.end(); }

                t.ok(agent.getTransaction(), "transaction should still be visible");

                t.notOk(nope, "should have removed document with id 2 from collection");

                transaction.end();

                t.equals(agent.metrics.getMetric('Database/all').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/allOther').callCount, 2,
                         "should find all operations");
                t.equals(agent.metrics.getMetric('Database/remove').callCount, 1,
                         "generic remove should be recorded");
                t.equals(agent.metrics.getMetric('Database/count').callCount, 1,
                         "generic count should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/remove').callCount, 1,
                         "named collection remove should be recorded");
                t.equals(agent.metrics.getMetric('Database/test/count').callCount, 1,
                         "named collection count should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/remove').callCount, 1,
                         "MongoDB remove should be recorded");
                t.equals(agent.metrics.getMetric('MongoDB/test/count').callCount, 1,
                         "MongoDB count should be recorded");

                var trace = transaction.getTrace();
                t.ok(trace, "trace should exist.");
                t.ok(trace.root, "root element should exist.");
                t.equals(trace.root.children.length, 2,
                         "should be two children.");

                var segment = trace.root.children[0];
                t.ok(segment, "trace segment for remove should exist");
                t.equals(segment.name, 'MongoDB/test/remove',
                         "should register the remove");

                segment = trace.root.children[1];
                t.ok(segment, "trace segment for count should exist");
                t.equals(segment.name, 'MongoDB/test/count',
                         "should register the count");
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

        t.test("with no callback (w = 0)", {timeout : 1000}, function (t) {
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
