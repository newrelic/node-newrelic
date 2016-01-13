'use strict'

var path = require('path')
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')


// CONSTANTS
var DB_COLLECTION = 'test_express'
var DB_URL = 'mongodb://' + params.mongodb_host + ':' + params.mongodb_port + '/integration'


test("Express 3 using async in routes with MongoDB",
    {timeout : Infinity,
     skip: semver.satisfies(process.version, "0.8")},
    function (t) {
  t.plan(24)

  var agent = helper.instrumentMockedAgent()
  var createServer = require('http').createServer
  var request = require('request')
  var async = require('async')
  var mongodb = require('mongodb')
  var ObjectID = mongodb.ObjectID
  var Server = mongodb.Server
  var Db = mongodb.Db
  var Collection = mongodb.Collection

  process.nr_agent = agent


  function find(id, next) {
    t.ok(agent.getTransaction(), "tracer state visible at start of find")
    Db.connect(DB_URL, function (error, client) {
      t.ok(agent.getTransaction(), "tracer state visible in find's connect callback")
      if (error) return next(error)

      var collection = new Collection(client, DB_COLLECTION)
      collection.find({_id : new ObjectID(id)}).nextObject(function cb_nextObject(err, obj) {
        t.ok(agent.getTransaction(), "tracer state visible in find callback")
        next(err, obj)
        client.close()
      })
    })
  }

  function update(obj, next) {
    t.ok(agent.getTransaction(), "tracer state visible at start of update")
    Db.connect(DB_URL, function (error, client) {
      t.ok(agent.getTransaction(), "tracer state visible in update's connect callback")
      if (error) return next(error)

      var objs = new Collection(client, DB_COLLECTION)
      objs.update({_id : obj._id}, obj, {upsert : false, safe : true}, function cb_update(err, obj) {
        next(err, obj)
        client.close()
      })
    })
  }

  function asyncFindAndUpdate(req, res) {
    t.ok(agent.getTransaction(), "tracer state visible at start of asyncFindAndUpdate")
    async.waterfall([
      function (next) {
        t.ok(agent.getTransaction(),
             "tracer state visible in first step of async waterfall")
        find(req.params.id, next)
      },
      function (obj, next) {
        t.ok(agent.getTransaction(),
             "tracer state visible in second step of async waterfall")
        if (!obj) return next(new Error("Couldn't load entity."))

        for (var i = 0; i < req.body.length; i++) {
          var item = req.body[i]
          var collection = (item.type === 'star') ? obj.star : obj.seen
          var index = collection.indexOf(item.id)


          if (item.status) {
            if (index === -1) {
              collection.push(item.id)
            }
          }
          else {
            if (index >= 0) delete collection[index]
          }
        }

        obj.metrics.postsRead = obj.seen.length
        obj.metrics.postsClicked = obj.star.length

        update(obj, next)
      }
    ],
    function (error) {
      t.ok(agent.getTransaction(),
           "tracer state visible at end of async waterfall")

      if (error) {
        res.send(500, {status : 'error', error : error.message})
      } else {
        res.send(200, {status : 'ok'})
      }
    })
  }

  function bootstrapExpress() {
    var express = require('express')
    var app = express()
    var bodyParser = express.bodyParser()
    var methodOverride = express.methodOverride()
    var router = app.router
    var errorHandler = express.errorHandler()



    app.configure(function cb_configure() {
      app.use(function cb_use(req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before body parsing")

        bodyParser(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after body parsing")
          next()
        })
      })

      app.use(function cb_use(req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before method overriding")

        methodOverride(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after method overriding")
          next()
        })
      })

      app.use(function cb_use(req, res, next) {
        t.ok(agent.getTransaction(), "tracer state visible before routing")

        router(req, res, function () {

          t.ok(agent.getTransaction(), "tracer state visible after routing")
          next()
        })
      })

      app.use(errorHandler)
    })

    app.post('/async/:id', asyncFindAndUpdate)

    return app
  }

  function populate(next) {
    var db = new Db('integration', new Server(params.mongodb_host, params.mongodb_port))
    db.open(function cb_open(error, db) {
      if (error) return next(error)

      db.collection(DB_COLLECTION, function (error, collection) {
        if (error) return next(error)
        var obj = {
          seen    : [1, 2, 3],
          star    : [4, 5, 6, 7, 8],
          metrics : {}
        }
        collection.insert(obj)

        db.on('close', function (error) { next(error, obj._id); })
        db.close()
      })
    })
  }

  /**
   **
   ** ACTUAL TEST
   **
   **/
  var self = this
  helper.bootstrapMongoDB([DB_COLLECTION], function cb_bootstrapMongoDB(error, service) {
    if (error) {
      t.fail(error)
      return t.end()
    }

    var app = bootstrapExpress()
    var server = createServer(function (req, res) {
      t.ok(agent.getTransaction(), "tracer state is visible in listener.")
      app(req, res)
    }).listen(8765)

    self.tearDown(function cb_tearDown() {
      server.close(function cb_close() {
        helper.unloadAgent(agent)
      })
    })

    populate(function (error, id) {
      if (error) {
        t.fail(error)
        return t.end()
      }

      function verifier(transaction) {
        var trace = transaction.trace
        var children = trace.root.children || []


        t.equal(children.length, 1, "only one child of root node")

        var web = children[0] || {}
        t.equal(web.name, 'WebTransaction/Expressjs/POST//async/:id',
                "first segment is web transaction")

        children = web.children || []
        t.equal(children.length, 1, "should have a MongoDB connection child")

        var connect = children[0]
        children = connect.children[1].children
        t.equal(
          connect.name,
          'Datastore/operation/MongoDB/connect',
          "only segment is MongoDB connect"
        )

        var nextObject = children[0]
        t.equal(nextObject.name, 'Datastore/statement/MongoDB/' + DB_COLLECTION + '/nextObject',
                "last segment is MongoDB nextObject")

        children = nextObject.children || []
        t.equal(children.length, 1, "should have a MongoDB connection child")

        var connect = children[0].children[0]
        children = connect.children[1].children
        t.equal(
          connect.name,
          'Datastore/operation/MongoDB/connect',
          "only segment is MongoDB connect"
        )

        var update = children[0] || {}
        t.equal(update.name, 'Datastore/statement/MongoDB/' + DB_COLLECTION + '/update',
                "third segment is MongoDB update")
        t.equal((update.children || []).length, 1, "should have a callback")
      }

      agent.on('transactionFinished', verifier)

      request.post(
        {
          url : 'http://localhost:8765/async/' + id,
          json : true,
          body : [{star : 4}]
        },
        function (error, response, body) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          t.equal(response.statusCode, 200, "status was OK")
          t.deepEqual(body, {status : 'ok'}, "got a response from the server")
        }
      )
    })
  })
})
