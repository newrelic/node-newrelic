'use strict';

var path   = require('path')
  , test   = require('tap').test
  , helper = require(path.join(__dirname, '..', '..', 'lib', 'agent_helper'))
  ;

var DB_URL = 'mongodb://localhost:27017/async_test';

test("Express 3 using async in routes with MongoDB", {timeout : Infinity}, function (t) {
  t.plan(24);

  var agent        = helper.instrumentMockedAgent()
    , createServer = require('http').createServer
    , request      = require('request')
    , async        = require('async')
    , mongodb      = require('mongodb')
    , ObjectID     = mongodb.ObjectID
    , Server       = mongodb.Server
    , Db           = mongodb.Db
    , Collection   = mongodb.Collection
    ;

  function find(id, next) {
    t.ok(agent.getTransaction(), "tracer state visible at start of find");
    Db.connect(DB_URL, function (error, client) {
      t.ok(agent.getTransaction(), "tracer state visible in find's connect callback");
      if (error) return next(error);

      var collection = new Collection(client, 'test');
      collection.find({_id : new ObjectID(id)}).nextObject(function (err, obj) {
        t.ok(agent.getTransaction(), "tracer state visible in find callback");
        next(err, obj);
      });
    });
  }

  function update(obj, next) {
    t.ok(agent.getTransaction(), "tracer state visible at start of update");
    Db.connect(DB_URL, function (error, client) {
      t.ok(agent.getTransaction(), "tracer state visible in update's connect callback");
      if (error) return next(error);

      var objs = new Collection(client, 'test');
      objs.update({_id : obj._id}, obj, {upsert : false, safe : true}, next);
    });
  }

  function asyncFindAndUpdate(req, res) {
    t.ok(agent.getTransaction(), "tracer state visible at start of asyncFindAndUpdate");
    async.waterfall([
      function (next) {
        t.ok(agent.getTransaction(),
             "tracer state visible in first step of async waterfall");
        find(req.params.id, next);
      },
      function (obj, next) {
        t.ok(agent.getTransaction(),
             "tracer state visible in second step of async waterfall");
        if (!obj) return next(new Error("Couldn't load entity."));

        for (var i = 0; i < req.body.length; i++) {
          var item       = req.body[i]
            , collection = (item.type === 'star') ? obj.star : obj.seen
            , index      = collection.indexOf(item.id)
            ;

          if (item.status) {
            if (index === -1) {
              collection.push(item.id);
            }
          }
          else {
            if (index >= 0) delete collection[index];
          }
        }

        obj.metrics.postsRead    = obj.seen.length;
        obj.metrics.postsClicked = obj.star.length;

        update(obj, next);
      }
    ],
    function (error) {
      t.ok(agent.getTransaction(),
           "tracer state visible at end of async waterfall");

      if (error) {
        res.send(500, {status : 'error', error : error.message});
      } else {
        res.send(200, {status : 'ok'});
      }
    });
  }

  function bootstrapExpress() {
    var express        = require('express')
      , app            = express()
      , bodyParser     = express.bodyParser()
      , methodOverride = express.methodOverride()
      , router         = app.router
      , errorHandler   = express.errorHandler()
      ;


    app.configure(function () {
      app.use(function (req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before body parsing");

        bodyParser(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after body parsing");
          next();
        });
      });

      app.use(function (req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before method overriding");

        methodOverride(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after method overriding");
          next();
        });
      });

      app.use(function (req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before routing");

        router(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after routing");
          next();
        });
      });

      app.use(errorHandler);
    });

    app.post('/async/:id', asyncFindAndUpdate);

    return app;
  }

  function populate(next) {
    var db = new Db('async_test', new Server('localhost', 27017));
    db.open(function (error, db) {
      if (error) return next(error);

      db.collection('test', function (error, collection) {
        if (error) return next(error);
        var obj = {
          seen    : [1, 2, 3],
          star    : [4, 5, 6, 7, 8],
          metrics : {}
        };
        collection.insert(obj);

        db.on('close', function (error) { next(error, obj._id); });
        db.close();
      });
    });
  }

  /**
   **
   ** ACTUAL TEST
   **
   **/
  var self = this;
  helper.bootstrapMongoDB(function (error, service) {
    if (error) {
      t.fail(error);
      return t.end();
    }

    var app = bootstrapExpress();
    var server = createServer(function (req, res) {
      t.ok(agent.getTransaction(), "tracer state is visible in listener.");
      app(req, res);
    }).listen(8765);

    self.tearDown(function () {
      server.close(function () {
        helper.cleanMongoDB(service, function () {
          helper.unloadAgent(agent);
        });
      });
    });

    populate(function (error, id) {
      if (error) {
        t.fail(error);
        return t.end();
      }

      function verifier(transaction) {
        var trace    = transaction.getTrace()
          , children = trace.root.children || []
          ;

        t.equal(children.length, 1, "only one child of root node");

        var web = children[0] || {};
        t.equal(web.name, 'WebTransaction/Expressjs/POST//async/:id',
                "first segment is web transaction");

        children = web.children || [];
        t.equal(children.length, 2, "only one child of web node");

        var find = children[0] || {};
        t.equal(find.name, 'Datastore/statement/MongoDB/test/find',
                "second segment is MongoDB find");
        t.equal((find.children || []).length, 0, "no children of find node");

        var update = children[1] || {};
        t.equal(update.name, 'Datastore/statement/MongoDB/test/update',
                "third segment is MongoDB update");
        t.equal((update.children || []).length, 0, "no children of update node");
      }

      agent.on('transactionFinished', verifier);

      request.post(
        {
          url : 'http://localhost:8765/async/' + id,
          json : true,
          body : [{star : 4}]
        },
        function (error, response, body) {
          if (error) {
            t.fail(error);
            return t.end();
          }

          t.equal(response.statusCode, 200, "status was OK");
          t.deepEqual(body, {status : 'ok'}, "got a response from the server");
        }
      );
    });
  });
});
