'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
var urltils = require('../../../lib/util/urltils')

if (semver.satisfies(process.version, '0.8')) {
  console.log('The latest versions of the mongo driver are not compatible with v0.8')
  return
}

var MONGO_SEGMENT_RE = /^Datastore\/.*?\/MongoDB/
var TRANSACTION_NAME = 'mongo test'
var DB_NAME = 'integration'
var METRIC_HOST_NAME = null
var METRIC_HOST_PORT = null

collectionTest('count', function countTest(t, collection, verify) {
  collection.find({}).count(function onCount(err, data) {
    t.notOk(err, 'should not error')
    t.equal(data, 30, 'should have correct result')
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/count'
    ], [
      'count'
    ])
  })
})

collectionTest('explain', function explainTest(t, collection, verify) {
  collection.find({}).explain(function onExplain(err, data) {
    t.notOk(err)
    t.equal(data.cursor, 'BasicCursor')
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/explain'
    ], [
      'explain'
    ])
  })
})

collectionTest('nextObject', function nextObjectTest(t, collection, verify) {
  collection.find({}).nextObject(function onNextObject(err, data) {
    t.notOk(err)
    t.equal(data.i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/nextObject'
    ], [
      'nextObject'
    ])
  })
})

collectionTest('next', function nextTest(t, collection, verify) {
  collection.find({}).next(function onNext(err, data) {
    t.notOk(err)
    t.equal(data.i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/next'
    ], [
      'next'
    ])
  })
})

collectionTest('toArray', function toArrayTest(t, collection, verify) {
  collection.find({}).toArray(function onToArray(err, data) {
    t.notOk(err)
    t.equal(data[0].i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/toArray'
    ], [
      'toArray'
    ])
  })
})

function collectionTest(name, run) {
  var collections = ['testCollection', 'testCollection2']

  tap.test(name, function(t) {
    var agent = null
    var db = null
    var collection = null
    t.autoend()

    t.beforeEach(function(done) {
      agent = helper.instrumentMockedAgent()
      helper.bootstrapMongoDB(collections, function(err) {
        if (err) {
          return done(err)
        }

        var mongodb = require('mongodb')
        var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
        db = new mongodb.Db(DB_NAME, server)
        METRIC_HOST_NAME = urltils.isLocalhost(params.mongodb_host)
          ? agent.config.getHostnameSafe()
          : params.mongodb_host
        METRIC_HOST_PORT = params.mongodb_port

        db.open(function(err) {
          if (err) {
            return done(err)
          }
          collection = db.collection('testCollection')
          populate(db, collection, done)
        })
      })
    })

    t.afterEach(function(done) {
      db.close(function(err) {
        helper.unloadAgent(agent)
        agent = null
        done(err)
      })
    })

    t.test('should not error outside of a transaction', function(t) {
      t.notOk(agent.getTransaction(), 'should not be in a transaction')
      run(t, collection, function(err) {
        t.notOk(err, 'running test should not error')
        t.notOk(agent.getTransaction(), 'should not somehow gain a transaction')
        t.end()
      })
    })

    t.test('should generate the correct metrics and segments', function(t) {
      helper.runInTransaction(agent, function(transaction) {
        transaction.name = TRANSACTION_NAME
        run(t, collection, function(err, segments, metrics) {
          if (
            !t.notOk(err, 'running test should not error') ||
            !t.ok(agent.getTransaction(), 'should maintain tx state')
          ) {
            return t.end()
          }
          t.equal(
            agent.getTransaction().id, transaction.id,
            'should not change transactions'
          )
          var segment = agent.tracer.getSegment()
          var current = transaction.trace.root

          for (var i = 0, l = segments.length; i < l; ++i) {
            t.equal(current.children.length, 1, 'should have one child')
            current = current.children[0]
            t.equal(current.name, segments[i], 'child should be named ' + segments[i])
            if (MONGO_SEGMENT_RE.test(current.name)) {
              checkSegmentParams(t, current)
            }
          }

          t.equal(current.children.length, 1, 'should have one last child')
          t.equal(current.children[0], segment, 'should test to the current child')

          transaction.end(function onTxEnd() {
            checkMetrics(t, agent, metrics || [])
            t.end()
          })
        })
      })
    })

    t.test('should respect `datastore_tracer.instance_reporting.enabled`', function(t) {
      agent.config.datastore_tracer.instance_reporting.enabled = false
      helper.runInTransaction(agent, function(tx) {
        run(t, collection, function(err) {
          if (!t.notOk(err, 'running test should not error')) {
            return t.end()
          }

          var current = tx.trace.root
          while (current) {
            if (MONGO_SEGMENT_RE.test(current.name)) {
              t.comment('Checking segment ' + current.name)
              t.notOk(
                current.parameters.hasOwnProperty('host'),
                'should not have host parameter'
              )
              t.notOk(
                current.parameters.hasOwnProperty('port_path_or_id'),
                'should not have port parameter'
              )
              t.ok(
                current.parameters.hasOwnProperty('database_name'),
                'should have database name parameter'
              )
            }
            current = current.children[0]
          }
          t.end()
        })
      })
    })

    t.test('should respect `datastore_tracer.database_name_reporting.enabled`', function(t) {
      agent.config.datastore_tracer.database_name_reporting.enabled = false
      helper.runInTransaction(agent, function(tx) {
        run(t, collection, function(err) {
          if (!t.notOk(err, 'running test should not error')) {
            return t.end()
          }

          var current = tx.trace.root
          while (current) {
            if (MONGO_SEGMENT_RE.test(current.name)) {
              t.comment('Checking segment ' + current.name)
              t.ok(
                current.parameters.hasOwnProperty('host'),
                'should have host parameter'
              )
              t.ok(
                current.parameters.hasOwnProperty('port_path_or_id'),
                'should have port parameter'
              )
              t.notOk(
                current.parameters.hasOwnProperty('database_name'),
                'should not have database name parameter'
              )
            }
            current = current.children[0]
          }
          t.end()
        })
      })
    })
  })
}

function checkMetrics(t, agent, metrics) {
  var unscopedMetrics = agent.metrics.unscoped
  var unscopedNames = Object.keys(unscopedMetrics)
  var scoped = agent.metrics.scoped[TRANSACTION_NAME]
  var total = 0
  var count
  var name

  if (!t.ok(scoped, 'should have scoped metrics')) {
    return
  }
  t.equal(Object.keys(agent.metrics.scoped).length, 1, 'should have one scoped metric')
  for (var i = 0; i < metrics.length; ++i) {
    if (Array.isArray(metrics[i])) {
      count = metrics[i][1]
      name = metrics[i][0]
    } else {
      count = 1
      name = metrics[i]
    }

    total += count

    t.equal(
      unscopedMetrics['Datastore/operation/MongoDB/' + name].callCount,
      count,
      'unscoped operation metric should be called ' + count + 'times'
    )
    t.equal(
      unscopedMetrics['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'unscoped statement metric should be called ' + count + 'times'
    )
    t.equal(
      scoped['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'scoped statement metric should be called ' + count + 'times'
    )
  }

  var expectedUnscopedCount = 5 + (2 * metrics.length)
  t.equal(
    unscopedNames.length, expectedUnscopedCount,
    'should have ' + expectedUnscopedCount + ' unscoped metrics'
  )
  var expectedUnscopedMetrics = [
    'Datastore/all',
    'Datastore/allOther',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allOther',
    'Datastore/instance/MongoDB/' + METRIC_HOST_NAME + '/' + METRIC_HOST_PORT
  ]
  expectedUnscopedMetrics.forEach(function(metric) {
    if (t.ok(unscopedMetrics[metric], 'should have unscoped metric ' + metric)) {
      t.equal(unscopedMetrics[metric].callCount, total, 'should have correct call count')
    }
  })
}

function checkSegmentParams(t, segment) {
  var parms = segment.parameters
  t.equal(parms.database_name, DB_NAME, 'should have correct db name')
  t.equal(parms.host, METRIC_HOST_NAME, 'should have correct host name')
  t.equal(parms.port_path_or_id, METRIC_HOST_PORT, 'should have correct port')
}

function populate(db, collection, done) {
  var items = []
  for (var i = 0; i < 30; ++i) {
    items.push({
      i: i,
      next3: [i + 1, i + 2, i + 3],
      data: Math.random().toString(36).slice(2),
      mod10: i % 10,
      // spiral out
      loc: [
        (i % 4 && (i + 1) % 4 ? i : -i),
        ((i + 1) % 4 && (i + 2) % 4 ? i : -i)
      ]
    })
  }

  db.dropCollection('testCollection2', function dropped() {
    collection.remove({}, function removed(err) {
      if (err) return done(err)
      collection.insert(items, done)
    })
  })
}
