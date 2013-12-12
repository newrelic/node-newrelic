'use strict';

var path = require('path')
  , test = require('tap').test
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

test("agent instrumentation of MongoDB when GridFS is used", function (t) {
  var context = this;
  helper.bootstrapMongoDB(function (err, app) {
    if (err) {
      t.fail(err);
      return t.end();
    }

    var agent = helper.instrumentMockedAgent();
    helper.runInTransaction(agent, function () {
      var mongodb = require('mongodb');

      mongodb.connect('mongodb://localhost:27017/noexist', function (err, db) {
        if (err) {
          t.fail(err);
          return t.end();
        }
        t.ok(db, "got MongoDB connection");

        context.tearDown(function () {
          helper.cleanMongoDB(app);
          db.close();
        });

        var GridStore = mongodb.GridStore
          , gs        = new GridStore(db, 'RandomFileName' + Math.random(), 'w')
          ;

        gs.open(function (err, gridfile) {
          if (err) {
            t.fail(err);
            return t.end();
          }
          t.ok(gridfile, "actually got file");

          t.end();
        });
      });
    });
  });
});
