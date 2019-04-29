'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


// CONSTANTS
var COLLECTION = 'test'
var COLLECTION_CURSOR = COLLECTION + '_cursor'

tap.test('MongoDB lifecycle', {timeout: 15000}, function(t) {
  t.plan(2)

  var agent = null
  var mongo = null
  var server = null
  var db = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    mongo = require('mongodb')
    server = new mongo.Server(
      params.mongodb_host,
      params.mongodb_port,
      {auto_reconnect: true}
    )
    db = new mongo.Db('integration', server, {safe: true})
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    db.close(true, function(error) {
      if (error) t.fail(error)
      done()
    })
  })

  helper.bootstrapMongoDB([COLLECTION, COLLECTION_CURSOR], function(error) {
    if (error) return t.fail(error)

    t.test('with a callback', function(t) {
      t.plan(21)

      agent.once('transactionFinished', function() {
        var metrics = agent.metrics
        t.equals(
          metrics.getMetric('Datastore/all').callCount,
          2,
          'should find both operations')
        t.equals(
          metrics.getMetric('Datastore/operation/MongoDB/insert').callCount,
          1,
          'basic insert should be recorded'
        )
        t.equals(
          metrics.getMetric('Datastore/operation/MongoDB/findOne').callCount,
          1,
          'basic findOne should be recorded'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION + '/insert'
          ).callCount,
          1,
          'collection insertion should be recorded'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION + '/findOne'
          ).callCount,
          1,
          'collection findOne should be recorded'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION + '/insert',
            'Datastore/statement/MongoDB/' + COLLECTION + '/insert'
          ).callCount,
          1,
          'Scoped MongoDB insert should be recorded'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION + '/findOne',
            'Datastore/statement/MongoDB/' + COLLECTION + '/insert'
          ).callCount,
          1,
          'Scoped MongoDB findOne should be recorded'
        )
      })

      db.open(function(err, dbHandle) {
        if (err) return t.fail(err)

        dbHandle.createCollection(COLLECTION, {safe: true}, function(err, collection) {
          if (err) return t.fail(err)
          t.notOk(agent.getTransaction(), 'no transaction should be in play yet')

          helper.runInTransaction(agent, function() {
            var tx = agent.getTransaction()
            t.ok(tx, 'transaction should be visible')
            // hardcode this because we're creating the transactional scope ourselves
            tx.name = 'Datastore/statement/MongoDB/' + COLLECTION + '/insert'

            var hunx = {id: 1, hamchunx: 'verbloks'}
            collection.insert(hunx, function(err) {
              if (err) return t.fail(err)

              t.ok(agent.getTransaction(), 'transaction should still be visible')

              collection.findOne({id: 1}, function(err, item) {
                if (err) return t.fail(err)

                t.ok(agent.getTransaction(), 'transaction should still still be visible')

                t.deepEquals(item, hunx, 'MongoDB should still work.')

                var trace = tx.trace
                t.ok(trace, 'trace should exist.')
                t.ok(trace.root, 'root element should exist.')
                t.ok(trace.root.children.length, 'There should be at least one child.')

                var insertSegment = trace.root.children[0]
                t.ok(insertSegment, 'trace segment for insert should exist')
                t.equals(
                  insertSegment.name,
                  'Datastore/statement/MongoDB/' + COLLECTION + '/insert',
                  'should register the insert'
                )
                t.equals(insertSegment.children.length, 1, 'insert should have a child')

                var findSegment = insertSegment.children[0].children[0]
                t.ok(findSegment, 'trace segment for findOne should exist')
                t.equals(
                  findSegment.name,
                  'Datastore/statement/MongoDB/' + COLLECTION + '/findOne',
                  'should register the findOne'
                )
                t.equals(
                  findSegment.children[0].children.length,
                  0,
                  'find should leave us here at the end'
                )

                tx.end()
                dbHandle.close(function(err) {
                  if (err) t.fail(err)
                  t.end()
                })
              })
            })
          })
        })
      })
    })

    t.test('with a Cursor', function(t) {
      t.plan(11)

      agent.once('transactionFinished', function() {
        var metrics = agent.metrics
        t.equals(
          metrics.getMetric('Datastore/all').callCount,
          3,
          'should find all operations including cursor'
        )
        t.equals(
          metrics.getMetric('Datastore/operation/MongoDB/insert').callCount,
          1,
          'basic insert should be recorded with cursor'
        )
        t.equals(
          metrics.getMetric('Datastore/operation/MongoDB/toArray').callCount,
          2,
          'basic find should be recorded with cursor'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert'
          ).callCount,
          1,
          'collection insertion should be recorded from cursor'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/toArray'
          ).callCount,
          2,
          'collection find should be recorded from cursor'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert',
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert'
          ).callCount,
          1,
          'scoped MongoDB insert should be recorded from cursor'
        )
        t.equals(
          metrics.getMetric(
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/toArray',
            'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert'
          ).callCount,
          2,
          'scoped MongoDB find should be recorded from cursor'
        )

        // disabled until metric explosions can be handled by server
        /*
        var instance =
          'Datastore/instance/MongoDB/' + params.mongodb_host + ':' + params.mongodb_port
        t.equals(
          metrics.getMetric(instance).callCount,
          3,
          'number of calls to the local MongoDB instance should be recorded'
        )
        */
      })

      db.open(function(err, dbHandle) {
        if (err) return t.fail(err)

        dbHandle.createCollection(COLLECTION_CURSOR, function(err, collection) {
          if (err) return t.fail(err)

          helper.runInTransaction(agent, function(tx) {
            // hardcode this because we're creating the transactional scope ourselves
            tx.name = 'Datastore/statement/MongoDB/' + COLLECTION_CURSOR + '/insert'
            var hunx = {id: 1, hamchunx: 'verbloks'}
            collection.insert(hunx, function() {
              var cursor = collection.find({id: 1})
              t.ok(cursor, 'cursor should be returned by callback-less find')

              cursor.toArray(function(err, results) {
                if (err) return t.fail(err)

                t.equals(results.length, 1, 'should be one result')
                t.equals(results[0].hamchunx, 'verbloks', 'driver should still work')

                var cursor2 = collection.find({id: 2})
                cursor2.toArray(function(err, result) {
                  if (err) return t.fail(err)

                  t.equals(result.length, 0, 'should be no results')

                  tx.end()
                  dbHandle.close(function cb_close(err) {
                    if (err) t.fail(err)

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
