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

var TRANSACTION_NAME = 'mongo test'
var DB_NAME = 'integration'
var METRIC_HOST_NAME = null
var METRIC_HOST_PORT = null


collectionTest('aggregate', function aggregateTest(t, collection, verify) {
  collection.aggregate(
    [
      {$sort: {i: 1}},
      {$match: {mod10: 5}},
      {$limit: 3},
      {$project: {value: '$i', _id: 0}}
    ],
    onResult
  )

  function onResult(err, data) {
    t.notOk(err)
    t.equal(data.length, 3)
    t.deepEqual(data, [{value: 5}, {value: 15}, {value: 25}])
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/aggregate',
      'Callback: onResult'
    ],
    ['aggregate'])
  }
})

collectionTest('bulkWrite', function bulkWriteTest(t, collection, verify) {
  collection.bulkWrite(
    [{deleteMany: {filter: {}}}, {insertOne: { document: { a: 1 }}}],
    {ordered: true, w: 1},
    onWrite
  )

  function onWrite(err, data) {
    t.notOk(err)
    t.equal(data.insertedCount, 1)
    t.equal(data.deletedCount, 30)
    verify(null, [
      'Datastore/statement/MongoDB/testCollection/bulkWrite',
      'Callback: onWrite'
    ],
    ['bulkWrite']
    )
  }
})

collectionTest('count', function countTest(t, collection, verify) {
  collection.count(function onCount(err, data) {
      t.notOk(err)
      t.equal(data, 30)
      verify(null, [
        'Datastore/statement/MongoDB/testCollection/count',
        'Callback: onCount'
      ],
      ['count']
      )
    }
  )
})

collectionTest('createIndex', function createIndexTest(t, collection, verify) {
  collection.createIndex('i', function onIndex(err, data) {
      t.notOk(err)
      t.equal(data, 'i_1')
      verify(null, [
        'Datastore/statement/MongoDB/testCollection/createIndex',
        'Callback: onIndex'
      ],
      ['createIndex']
      )
    }
  )
})

collectionTest('deleteMany', function deleteManyTest(t, collection, verify) {
  collection.deleteMany({mod10: 5}, function done(err, data) {
      t.notOk(err)
      t.deepEqual(data.result, {ok: 1, n: 3})
      verify(null, [
        'Datastore/statement/MongoDB/testCollection/deleteMany',
        'Callback: done'
      ],
      ['deleteMany']
      )
    }
  )
})

collectionTest('deleteOne', function deleteOneTest(t, collection, verify) {
  collection.deleteOne({mod10: 5}, function done(err, data) {
      t.notOk(err)
      t.deepEqual(data.result, {ok: 1, n: 1})
      verify(null, [
        'Datastore/statement/MongoDB/testCollection/deleteOne',
        'Callback: done'
      ],
      ['deleteOne']
      )
    }
  )
})

collectionTest('distinct', function distinctTest(t, collection, verify) {
  collection.distinct('mod10', function done(err, data) {
      t.notOk(err)
      t.deepEqual(data.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      verify(null, [
        'Datastore/statement/MongoDB/testCollection/distinct',
        'Callback: done'
      ],
      ['distinct']
      )
    }
  )
})

collectionTest('drop', function dropTest(t, collection, verify) {
  collection.drop(function done(err, data) {
      t.notOk(err)
      t.equal(data, true)
      verify(null, [
          'Datastore/statement/MongoDB/testCollection/drop',
          'Callback: done'
        ],
        ['drop']
      )
    }
  )
})

collectionTest('dropAllIndexes', function dropAllIndexesTest(t, collection, verify) {
  collection.dropAllIndexes(function done(err, data) {
      t.notOk(err)
      t.equal(data, true)
      verify(null, [
          'Datastore/statement/MongoDB/testCollection/dropAllIndexes',
          'Callback: done'
        ],
        ['dropAllIndexes']
      )
    }
  )
})

collectionTest('dropIndex', function dropIndexTest(t, collection, verify) {
  collection.createIndex('i', function onIndex(err) {
    t.notOk(err)
    collection.dropIndex('i_1', function done(err, data) {
      t.notOk(err)
      t.equal(data.ok, 1)
      verify(null, [
          'Datastore/statement/MongoDB/testCollection/createIndex',
          'Callback: onIndex',
          'Datastore/statement/MongoDB/testCollection/dropIndex',
          'Callback: done'
        ],
        ['createIndex', 'dropIndex']
      )
    })
  })
})

collectionTest('ensureIndex', function ensureIndexTest(t, collection, verify) {
  collection.ensureIndex('i', function done(err, data) {
    t.notOk(err)
    t.equal(data, 'i_1')
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/ensureIndex',
        'Callback: done'
      ],
      ['ensureIndex']
    )
  })
})

collectionTest('findAndModify', function findAndModifyTest(t, collection, verify) {
  collection.findAndModify({i: 1}, [['i', 1]], {$set: {a: 15}}, {new: true}, done)

  function done(err, data) {
    t.notOk(err)
    t.equal(data.value.a, 15)
    t.equal(data.value.i, 1)
    t.equal(data.ok, 1)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findAndModify',
        'Callback: done'
      ],
      ['findAndModify']
    )
  }
})

collectionTest('findAndRemove', function findAndRemoveTest(t, collection, verify) {
  collection.findAndRemove({i: 1}, [['i', 1]], function done(err, data) {
    t.notOk(err)
    t.equal(data.value.i, 1)
    t.equal(data.ok, 1)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findAndRemove',
        'Callback: done'
      ],
      ['findAndRemove']
    )
  })
})

collectionTest('findOne', function findOneTest(t, collection, verify) {
  collection.findOne({i: 15}, function done(err, data) {
    t.notOk(err)
    t.equal(data.i, 15)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findOne',
        'Callback: done'
      ],
      ['findOne']
    )
  })
})

collectionTest('findOneAndDelete', function findOneAndDeleteTest(t, collection, verify) {
  collection.findOneAndDelete({i: 15}, function done(err, data) {
    t.notOk(err)
    t.equal(data.ok, 1)
    t.equal(data.value.i, 15)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findOneAndDelete',
        'Callback: done'
      ],
      ['findOneAndDelete']
    )
  })
})

collectionTest('findOneAndReplace', function findAndReplaceTest(t, collection, verify) {
  collection.findOneAndReplace({i: 15}, {b: 15}, {returnOriginal: false}, done)

  function done(err, data) {
    t.notOk(err)
    t.equal(data.value.b, 15)
    t.equal(data.ok, 1)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findOneAndReplace',
        'Callback: done'
      ],
      ['findOneAndReplace']
    )
  }
})

collectionTest('findOneAndUpdate', function findOneAndUpdateTest(t, collection, verify) {
  collection.findOneAndUpdate({i: 15}, {$set: {a: 15}}, {returnOriginal: false}, done)

  function done(err, data) {
    t.notOk(err)
    t.equal(data.value.a, 15)
    t.equal(data.ok, 1)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/findOneAndUpdate',
        'Callback: done'
      ],
      ['findOneAndUpdate']
    )
  }
})

collectionTest('geoHaystackSearch', function haystackSearchTest(t, collection, verify) {
  collection.ensureIndex({loc: 'geoHaystack', type: 1}, {bucketSize: 1}, indexed)

  function indexed(err) {
    t.notOk(err)
    collection.geoHaystackSearch(15, 15, {maxDistance: 5, search: {}}, done)
  }

  function done(err, data) {
    t.notOk(err)
    t.equal(data.ok, 1)
    t.equal(data.results.length, 2)
    t.equal(data.results[0].i, 13)
    t.equal(data.results[1].i, 17)
    t.deepEqual(data.results[0].loc, [13, 13])
    t.deepEqual(data.results[1].loc, [17, 17])
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/ensureIndex',
        'Callback: indexed',
        'Datastore/statement/MongoDB/testCollection/geoHaystackSearch',
        'Callback: done'
      ],
      ['ensureIndex', 'geoHaystackSearch']
    )
  }
})

collectionTest('geoNear', function geoNearTest(t, collection, verify) {
  collection.ensureIndex({loc: '2d'}, {bucketSize: 1}, indexed)

  function indexed(err) {
    t.notOk(err)
    collection.geoNear(20, 20, {maxDistance: 5}, done)
  }

  function done(err, data) {
    t.notOk(err)
    t.equal(data.ok, 1)
    t.equal(data.results.length, 2)
    t.equal(data.results[0].obj.i, 21)
    t.equal(data.results[1].obj.i, 17)
    t.deepEqual(data.results[0].obj.loc, [21, 21])
    t.deepEqual(data.results[1].obj.loc, [17, 17])
    t.equal(data.results[0].dis, 1.4142135623730951)
    t.equal(data.results[1].dis, 4.242640687119285)
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/ensureIndex',
        'Callback: indexed',
        'Datastore/statement/MongoDB/testCollection/geoNear',
        'Callback: done'
      ],
      ['ensureIndex', 'geoNear']
    )
  }
})

collectionTest('group', function groupTest(t, collection, verify) {
  collection.group(['mod10'], {}, {count: 0, total: 0}, count, done)

  function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.sort(sort), [
      {mod10: 0, count: 3, total: 30},
      {mod10: 1, count: 3, total: 33},
      {mod10: 2, count: 3, total: 36},
      {mod10: 3, count: 3, total: 39},
      {mod10: 4, count: 3, total: 42},
      {mod10: 5, count: 3, total: 45},
      {mod10: 6, count: 3, total: 48},
      {mod10: 7, count: 3, total: 51},
      {mod10: 8, count: 3, total: 54},
      {mod10: 9, count: 3, total: 57}
    ])
    verify(null, [
        'Datastore/statement/MongoDB/testCollection/group',
        'Callback: done'
      ],
      ['group']
    )
  }

  function count(obj, prev) {
    prev.total += obj.i
    prev.count++
  }

  function sort(a, b) {
    return a.mod10 - b.mod10
  }
})

collectionTest('indexes', function indexesTest(t, collection, verify) {
  collection.indexes(function done(err, data) {
    t.notOk(err)
    t.deepEqual(data, [{
      v: 1,
      key: {_id: 1},
      name: '_id_',
      ns: DB_NAME + '.testCollection'
    }])

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/indexes',
        'Callback: done'
      ],
      ['indexes']
    )
  })
})

collectionTest('indexExists', function indexExistsTest(t, collection, verify) {
  collection.indexExists(['_id_'], function done(err, data) {
    t.notOk(err)
    t.equal(data, true)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/indexExists',
        'Callback: done'
      ],
      ['indexExists']
    )
  })
})

collectionTest('indexInformation', function indexInformationTest(t, collection, verify) {
  collection.indexInformation(function done(err, data) {
    t.notOk(err)
    t.deepEqual(data, {_id_: [['_id', 1]]})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/indexInformation',
        'Callback: done'
      ],
      ['indexInformation']
    )
  })
})

collectionTest('insert', function insertTest(t, collection, verify) {
  collection.insert({foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/insert',
        'Callback: done'
      ],
      ['insert']
    )
  })
})

collectionTest('insertMany', function insertManyTest(t, collection, verify) {
  collection.insertMany([{foo: 'bar'}, {foo: 'bar2'}], function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, n: 2})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/insertMany',
        'Callback: done'
      ],
      ['insertMany']
    )
  })
})

collectionTest('insertOne', function insertOneTest(t, collection, verify) {
  collection.insertOne({foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/insertOne',
        'Callback: done'
      ],
      ['insertOne']
    )
  })
})

collectionTest('isCapped', function isCappedTest(t, collection, verify) {
  collection.isCapped(function done(err, data) {
    t.notOk(err)
    t.notOk(data)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/isCapped',
        'Callback: done'
      ],
      ['isCapped']
    )
  })
})

collectionTest('mapReduce', function mapReduceTest(t, collection, verify) {
  collection.mapReduce(map, reduce, {out: {inline: 1}}, done)

  function done(err, data) {
    t.notOk(err)
    t.deepEqual(data, [
      {_id: 0, value: 30},
      {_id: 1, value: 33},
      {_id: 2, value: 36},
      {_id: 3, value: 39},
      {_id: 4, value: 42},
      {_id: 5, value: 45},
      {_id: 6, value: 48},
      {_id: 7, value: 51},
      {_id: 8, value: 54},
      {_id: 9, value: 57}
    ])

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/mapReduce',
        'Callback: done'
      ],
      ['mapReduce']
    )
  }

  /* eslint-disable */
  function map(obj) {
    emit(this.mod10, this.i)
  }
  /* eslint-enable */

  function reduce(key, vals) {
    return vals.reduce(function sum(prev, val) {
      return prev + val
    }, 0)
  }
})

collectionTest('options', function optionsTest(t, collection, verify) {
  collection.options(function done(err, data) {
    t.notOk(err)
    t.notOk(data)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/options',
        'Callback: done'
      ],
      ['options']
    )
  })
})

collectionTest('parallelCollectionScan', function(t, collection, verify) {
  collection.parallelCollectionScan({numCursors: 1}, function done(err, cursors) {
    t.notOk(err)

    cursors[0].toArray(function toArray(err, items) {
      t.notOk(err)
      t.equal(items.length, 30)

      var total = items.reduce(function sum(prev, item) {
        return item.i + prev
      }, 0)

      t.equal(total, 435)
      verify(null, [
          'Datastore/statement/MongoDB/testCollection/parallelCollectionScan',
          'Callback: done',
          'Datastore/statement/MongoDB/testCollection/toArray',
          'Callback: toArray',
        ],
        ['parallelCollectionScan', 'toArray']
      )
    })
  })
})

collectionTest('reIndex', function reIndexTest(t, collection, verify) {
  collection.reIndex(function done(err, data) {
    t.notOk(err)
    t.equal(data, true)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/reIndex',
        'Callback: done'
      ],
      ['reIndex']
    )
  })
})

collectionTest('remove', function removeTest(t, collection, verify) {
  collection.remove({mod10: 5}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, n: 3})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/remove',
        'Callback: done'
      ],
      ['remove']
    )
  })
})

collectionTest('rename', function renameTest(t, collection, verify) {
  collection.rename('testCollection2', function done(err) {
    t.notOk(err)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/rename',
        'Callback: done'
      ],
      ['rename']
    )
  })
})

collectionTest('replaceOne', function replaceOneTest(t, collection, verify) {
  collection.replaceOne({i: 5}, {foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/replaceOne',
        'Callback: done'
      ],
      ['replaceOne']
    )
  })
})

collectionTest('save', function saveTest(t, collection, verify) {
  collection.save({foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, n: 1})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/save',
        'Callback: done'
      ],
      ['save']
    )
  })
})

collectionTest('stats', function statsTest(t, collection, verify) {
  collection.stats({i: 5}, {foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.equal(data.ns, DB_NAME + '.testCollection')
    t.equal(data.count, 30)
    t.equal(data.ok, 1)

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/stats',
        'Callback: done'
      ],
      ['stats']
    )
  })
})

collectionTest('update', function updateTest(t, collection, verify) {
  collection.update({i: 5}, {foo: 'bar'}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/update',
        'Callback: done'
      ],
      ['update']
    )
  })
})

collectionTest('updateMany', function updateManyTest(t, collection, verify) {
  collection.updateMany({mod10: 5}, {$set: {a: 5}}, function done(err, data) {
    t.notOk(err)
    t.deepEqual(data.result, {ok: 1, nModified: 3, n: 3})

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/updateMany',
        'Callback: done'
      ],
      ['updateMany']
    )
  })
})

collectionTest('updateOne', function updateOneTest(t, collection, verify) {
  collection.updateOne({i: 5}, {$set: {a: 5}}, function done(err, data) {
    t.notOk(err, 'should not error')
    t.deepEqual(data.result, {ok: 1, nModified: 1, n: 1}, 'should have correct results')

    verify(null, [
        'Datastore/statement/MongoDB/testCollection/updateOne',
        'Callback: done'
      ],
      ['updateOne']
    )
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
            if (/^Datastore\/.*?\/MongoDB/.test(current.name)) {
              checkSegmentParams(t, current)
            }
          }

          t.equal(current.children.length, 0, 'should have no more children')
          t.equal(current, segment, 'should test to the current segment')

          transaction.end(function onTxEnd() {
            checkMetrics(t, agent, metrics || [])
            t.end()
          })
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
  var dbName = DB_NAME
  if (/\/rename$/.test(segment.name)) {
    dbName = 'admin'
  }

  var parms = segment.parameters
  t.equal(parms.database_name, dbName, 'should have correct db name')
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
