'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
if (semver.satisfies(process.version, '0.8')) {
  console.log('The latest versions of the mongo driver are not compatible with v0.8')
  return
}

collectionTest('count', function countTest(t, collection, verify) {
  collection.find({}).count(function onCount(err, data) {
    t.notOk(err)
    t.equal(data, 30)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/count'
    ],
    ['count']
    )
  })
})

collectionTest('explain', function explainTest(t, collection, verify) {
  collection.find({}).explain(function onExplain(err, data) {
    t.notOk(err)
    t.equal(data.cursor, 'BasicCursor')
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/explain'
    ],
    ['explain']
    )
  })
})

collectionTest('nextObject', function nextObjectTest(t, collection, verify) {
  collection.find({}).nextObject(function onNextObject(err, data) {
    t.notOk(err)
    t.equal(data.i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/nextObject'
    ],
    ['nextObject']
    )
  })
})

collectionTest('next', function nextTest(t, collection, verify) {
  collection.find({}).next(function onNext(err, data) {
    t.notOk(err)
    t.equal(data.i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/next'
    ],
    ['next']
    )
  })
})

collectionTest('toArray', function toArrayTest(t, collection, verify) {
  collection.find({}).toArray(function onToArray(err, data) {
    t.notOk(err)
    t.equal(data[0].i, 0)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/toArray'
    ],
    ['toArray']
    )
  })
})

function collectionTest(name, run) {
  mongoTest(name, ['testCollection', 'testCollection2'], function init(t, agent) {
    var mongodb = require('mongodb')
    var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)

    var db = new mongodb.Db('integration', server, {w: 1})
    db.open(onOpen)

    function onOpen(err, db) {
      if (err) return finish(err)
      t.tearDown(function tearDown() {
        db.close()
      })

      db.collection('testCollection', gotCollection)
    }

    function gotCollection(err, collection) {
      if (err) return finish(err)
      populate(db, collection, populated)

      function populated(err) {
        if (err) return finish(err)
        run(t, collection, withoutTransaction)
      }


      function withoutTransaction(err) {
        if (err) return finish(err)

        t.notOk(agent.getTransaction())
        populate(db, collection, function populated(err) {
          if (err) return finish(err)
          helper.runInTransaction(agent, withTransaction)
        })
      }

      function withTransaction(transaction) {
        transaction.setBackgroundName('name', 'group')
        run(t, collection, verify)

        function verify(err, segments, metrics) {
          if (err) return finish(err)
          t.equal(agent.getTransaction(), transaction)
          var segment = agent.tracer.getSegment()
          var current = transaction.trace.root

          for (var i = 0, l = segments.length; i < l; ++i) {
            t.equal(current.children.length, 1)
            current = current.children[0]
            t.equal(current.name, segments[i])
          }

          t.equal(current.children.length, 1)

          t.equal(current.children[0], segment)
          transaction.end(function onEnd() {
            checkMetrics(t, agent, metrics || [], finish)
          })
        }
      }
    }

    function finish(err) {
      if (err) {
        t.fail(err)
      }

      setTimeout(function end() {
        t.end()
      }, 10)
    }
  })
}

function checkMetrics(t, agent, metrics, finish) {
  var unscopedNames = Object.keys(agent.metrics.unscoped)
  var scoped = agent.metrics.scoped['OtherTransaction/group/name']
  var total = 0
  var count
  var name

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
      agent.metrics.unscoped['Datastore/operation/MongoDB/' + name].callCount,
      count
    )
    t.equal(
      agent.metrics.unscoped['Datastore/statement/MongoDB/testCollection/' +
      name].callCount,
      count
    )
    t.equal(
      scoped['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count
    )
  }

  t.ok(scoped)
  t.equal(Object.keys(agent.metrics.scoped).length, 1)
  t.equal(unscopedNames.length, 4 + 2 * metrics.length)
  t.equal(agent.metrics.unscoped['Datastore/all'].callCount, total)
  t.equal(agent.metrics.unscoped['Datastore/allOther'].callCount, total)
  t.equal(agent.metrics.unscoped['Datastore/MongoDB/all'].callCount, total)
  t.equal(agent.metrics.unscoped['Datastore/MongoDB/allOther'].callCount, total)

  finish()
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

function mongoTest(name, collections, run) {
  tap.test(function testWrap(t) {
    helper.bootstrapMongoDB(collections, function bootstrapped(err) {
      if (err) {
        t.fail(err)
        return t.end()
      }

      run(t, helper.loadTestAgent(t))
    })
  })
}
