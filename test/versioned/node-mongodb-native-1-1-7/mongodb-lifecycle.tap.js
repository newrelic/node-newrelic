'use strict'

var path   = require('path')
  , tap    = require('tap')
  , test   = tap.test
  , helper = require('../../lib/agent_helper')
  , params = require('../../lib/params')
  

// CONSTANTS
var COLLECTION = 'test_1_1_7'
  , COLLECTION_CURSOR = COLLECTION + '_cursor'
  

test("MongoDB instrumentation should put DB calls in the transaction trace",
     {timeout : 15000},
     function (t) {
  t.plan(2)

  var self = this
  helper.bootstrapMongoDB([COLLECTION, COLLECTION_CURSOR], function cb_bootstrapMongoDB(error, app) {
    if (error) return t.fail(error)

    t.test("with a callback", function (t) {
      t.plan(21)

      var agent = helper.instrumentMockedAgent()
      var mongodb = require('mongodb')
      var server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {auto_reconnect : true})
      var db = new mongodb.Db('integration', server, {safe : true})

      this.tearDown(function cb_tearDown() {
        db.close(true, function (error) {
          if (error) t.fail(error)
        })
        helper.unloadAgent(agent)
      })

      agent.once('transactionFinished', function () {
        t.equals(agent.metrics.getMetric('Datastore/all').callCount, 2,
                 "should find both operations")
        t.equals(
          agent.metrics.getMetric('Datastore/operation/MongoDB/insert').callCount,
          1,
          "basic insert should be recorded"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/operation/MongoDB/findOne').callCount,
          1,
          "basic findOne should be recorded"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION + '/insert').callCount,
          1,
          "collection insertion should be recorded"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION + '/findOne').callCount,
          1,
          "collection findOne should be recorded"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION + '/insert',
                                  'Datastore/statement/MongoDB/' + COLLECTION + '/insert').callCount,
          1,
          "Scoped MongoDB insert should be recorded"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION + '/findOne',
                                  'Datastore/statement/MongoDB/' + COLLECTION + '/insert').callCount,
          1,
          "Scoped MongoDB findOne should be recorded"
        )
      })

      db.open(function cb_open(error, db) {
        if (error) return t.fail(error)

        db.createCollection(COLLECTION, {safe : true}, function (error, collection) {
          if (error) return t.fail(error)
          t.notOk(agent.getTransaction(), "no transaction should be in play yet")

          helper.runInTransaction(agent, function transactionInScope() {
            var transaction = agent.getTransaction()
            t.ok(transaction, "transaction should be visible")
            // hardcode this because we're creating the transactional scope ourselves
            transaction.name = 'Datastore/statement/MongoDB/' + COLLECTION + '/insert'

            var hunx = {id : 1, hamchunx : "verbloks"}
            collection.insert(hunx, function insertCallback(error) {
              if (error) return t.fail(error)

              t.ok(agent.getTransaction(), "transaction should still be visible")

              collection.findOne({id : 1}, function findOneCallback(error, item) {
                if (error) return t.fail(error)

                t.ok(agent.getTransaction(), "transaction should still still be visible")

                t.deepEquals(item, hunx, "MongoDB should still work.")

                transaction.end()

                var trace = transaction.getTrace()
                t.ok(trace, "trace should exist.")
                t.ok(trace.root, "root element should exist.")
                t.equals(trace.root.children.length, 1,
                         "There should be only one child.")

                var insertSegment = trace.root.children[0]
                t.ok(insertSegment, "trace segment for insert should exist")
                t.equals(insertSegment.name, "Datastore/statement/MongoDB/" + COLLECTION + "/insert",
                         "should register the insert")
                t.equals(insertSegment.children.length, 1, "insert should have a child")

                var findSegment = insertSegment.children[0]
                t.ok(findSegment, "trace segment for findOne should exist")
                t.equals(findSegment.name, "Datastore/statement/MongoDB/" + COLLECTION + "/findOne",
                         "should register the findOne")
                t.equals(findSegment.children.length, 0,
                         "find should leave us here at the end")

                db.close(function cb_close(error) {
                  if (error) t.fail(error)

                  t.end()
                })
              })
            })
          })
        })
      })
    })

    t.test("with a Cursor", function (t) {
      t.plan(12)

      var agent = helper.instrumentMockedAgent()
      var mongodb = require('mongodb')
      var server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {auto_reconnect : true})
      var db = new mongodb.Db('integration', server, {safe : true})

      this.tearDown(function cb_tearDown() {
        db.close(true, function (error) {
          if (error) t.fail(error)
        })
        helper.unloadAgent(agent)
      })

      agent.once('transactionFinished', function () {
        t.equals(
          agent.metrics.getMetric('Datastore/all').callCount,
          3,
          "should find all operations including cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/operation/MongoDB/insert').callCount,
          1,
          "basic insert should be recorded with cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/operation/MongoDB/find').callCount,
          2,
          "basic find should be recorded with cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert').callCount,
          1,
          "collection insertion should be recorded from cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/find').callCount,
          2,
          "collection find should be recorded from cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert',
                                  'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert').callCount,
          1,
          "scoped MongoDB insert should be recorded from cursor"
        )
        t.equals(
          agent.metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/find',
                                  'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert').callCount,
          2,
          "scoped MongoDB find should be recorded from cursor"
        )
        var instance = 'Datastore/instance/MongoDB/' + params.mongodb_host + ':' + params.mongodb_port
        t.equals(
          agent.metrics.getMetric(instance).callCount,
          3,
          "number of calls to the local MongoDB instance should be recorded"
        )
      })

      db.open(function cb_open(error, db) {
        if (error) return t.fail(error)

        db.createCollection(COLLECTION_CURSOR, function (error, collection) {
          if (error) return t.fail(error)

          helper.runInTransaction(agent, function transactionInScope(transaction) {
            // hardcode this because we're creating the transactional scope ourselves
            transaction.name = 'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert'
            var hunx = {id : 1, hamchunx : "verbloks"}
            collection.insert(hunx, function () {
              var cursor = collection.find({id : 1})
              t.ok(cursor, "cursor should be returned by callback-less find")

              cursor.toArray(function cb_toArray(error, results) {
                if (error) return t.fail(error)

                t.equals(results.length, 1, "should be one result")
                t.equals(results[0].hamchunx, 'verbloks', "driver should still work")

                var cursor2 = collection.find({id : 2})
                cursor2.toArray(function cb_toArray(error, results) {
                  if (error) return t.fail(error)

                  t.equals(results.length, 0, "should be no results")

                  transaction.end()

                  db.close(function cb_close(error) {
                    if (error) t.fail(error)

                    t.end()
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
