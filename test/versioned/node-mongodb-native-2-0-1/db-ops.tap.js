'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
if (semver.satisfies(process.version, '0.8')) {
  console.log('The latest versions of the mongo driver are not compatible with v0.8')
  return
}

mongoTest('open', [], function openTest(t, agent) {
  var mongodb = require('mongodb')
  var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
  var db = new mongodb.Db('integration', server)

  helper.runInTransaction(agent, function inTransaction(transaction) {
    db.open(function onOpen(err, _db) {
      var segment = agent.tracer.getSegment()
      t.notOk(err)
      t.equal(db, _db)
      t.equal(agent.getTransaction(), transaction)
      t.equal(segment.name, 'Callback: onOpen')
      t.equal(transaction.trace.root.children.length, 1)
      var parent = transaction.trace.root.children[0]
      t.equal(parent.name, 'Datastore/operation/MongoDB/open')
      t.notEqual(parent.children.indexOf(segment), -1)
      db.close()
      t.end()
    })
  })
})

dbTest('addUser, authenticate,  removeUser', [], function addUserTest(t, db, verify) {
  db.addUser('user-test', 'user-test-pass', function added(err, user) {
    t.notOk(err)
    db.authenticate('user-test', 'user-test-pass', function authed(err2) {
      t.notOk(err2)
      db.removeUser('user-test', function removed(err3) {
        t.notOk(err3)
        t.equal(user[0].user, 'user-test')
        verify([
          'Datastore/operation/MongoDB/addUser',
          'Callback: added',
          'Datastore/operation/MongoDB/authenticate',
          'Callback: authed',
          'Datastore/operation/MongoDB/removeUser',
          'Callback: removed'
        ])
      })
    })
  })
})

dbTest('collection', ['testCollection'], function collectionTest(t, db, verify) {
  db.collection('testCollection', function gotCollection(err, collection) {
    t.notOk(err)
    t.ok(collection)
    verify([
      'Datastore/operation/MongoDB/collection',
      'Callback: gotCollection',
    ])
  })
})

dbTest('collections', [], function collectionTest(t, db, verify) {
  db.collections(function gotCollections(err2, collections) {
    t.notOk(err2)
    t.ok(Array.isArray(collections))
    verify([
      'Datastore/operation/MongoDB/collections',
      'Callback: gotCollections',
    ])
  })
})

dbTest('command', [], function commandTest(t, db, verify) {
  db.command({ping: 1}, function onCommand(err, result) {
   t.equal(null, err)
   t.deepEqual(result, {ok: 1})
   verify([
     'Datastore/operation/MongoDB/command',
     'Callback: onCommand',
   ])
 })
})

dbTest('createCollection', ['testCollection'], function createTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err, collection) {
    t.notOk(err)
    t.equal(collection.s.name, 'testCollection')
    verify([
      'Datastore/operation/MongoDB/createCollection',
      'Callback: gotCollection',
    ])
  })
})

dbTest('createIndex', ['testCollection'], function createIndexTest(t, db, verify) {
  db.createIndex('testCollection', 'foo', function createdIndex(err, result) {
    t.notOk(err)
    t.equal(result, 'foo_1')
    verify([
      'Datastore/operation/MongoDB/createIndex',
      'Callback: createdIndex',
    ])
  })
})

dbTest('dropCollection', ['testCollection'], function dropTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err, collection) {
    db.dropCollection('testCollection', function droppedCollection(err, result) {
      t.notOk(err)
      t.ok(result)
      verify([
        'Datastore/operation/MongoDB/createCollection',
        'Callback: gotCollection',
        'Datastore/operation/MongoDB/dropCollection',
        'Callback: droppedCollection',
      ])
    })
  })
})

dbTest('dropDatabase', ['testCollection'], function dropDbTest(t, db, verify) {
  db.dropDatabase(function droppedDatabase(err, result) {
    t.notOk(err)
    t.ok(result)
    verify([
      'Datastore/operation/MongoDB/dropDatabase',
      'Callback: droppedDatabase',
    ])
  })
})

dbTest('ensureIndex', ['testCollection'], function ensureIndexTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err, result) {
    t.notOk(err)
    t.equal(result, 'foo_1')
    verify([
      'Datastore/operation/MongoDB/ensureIndex',
      'Callback: ensuredIndex',
    ])
  })
})

dbTest('eval', [], function evalTest(t, db, verify) {
  db.eval('function (x) {return x;}', [3], function evaled(err, result) {
    t.equal(err, null)
    t.equal(3, result)
    verify([
      'Datastore/operation/MongoDB/eval',
      'Callback: evaled',
    ])
  })
})

dbTest('indexInformation', ['testCollection'], function indexInfoTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err) {
    t.notOk(err)
    db.indexInformation('testCollection', function gotInfo(err2, result) {
      t.notOk(err2)
      t.deepEqual(result, { _id_: [ [ '_id', 1 ] ], foo_1: [ [ 'foo', 1 ] ] })
      verify([
        'Datastore/operation/MongoDB/ensureIndex',
        'Callback: ensuredIndex',
        'Datastore/operation/MongoDB/indexInformation',
        'Callback: gotInfo',
      ])
    })
  })
})

dbTest('logout', [], function logoutTest(t, db, verify) {
  db.logout({}, function loggedOut(err) {
    t.equal(err, null)
    verify([
      'Datastore/operation/MongoDB/logout',
      'Callback: loggedOut',
    ])
  })
})


dbTest('renameCollection', ['testCollection', 'testCollection2'], function dropTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err, collection) {
    t.notOk(err)
    db.renameCollection('testCollection', 'testCollection2', function renamedCollection(err2) {
      t.notOk(err2)
      db.dropCollection('testCollection2', function droppedCollection(err3) {
        t.notOk(err3)
        verify([
          'Datastore/operation/MongoDB/createCollection',
          'Callback: gotCollection',
          'Datastore/operation/MongoDB/renameCollection',
          'Callback: renamedCollection',
          'Datastore/operation/MongoDB/dropCollection',
          'Callback: droppedCollection',
        ])
      })
    })
  })
})

dbTest('stats', [], function logoutTest(t, db, verify) {
  db.stats({}, function gotStats(err, stats) {
    t.equal(err, null)
    t.ok(stats)
    verify([
      'Datastore/operation/MongoDB/stats',
      'Callback: gotStats',
    ])
  })
})

function dbTest(name, collections, run) {
  mongoTest(name, collections, function init(t, agent) {
    var mongodb = require('mongodb')
    var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
    var db = new mongodb.Db('integration', server)

    db.open(function onOpen(err) {
      if (err) {
        t.fail(err)
        return t.end()
      }

      t.tearDown(function tearDown() {
        db.close()
      })

      run(t, db, withoutTransaction)
    })

    function withoutTransaction() {
      t.notOk(agent.getTransaction())
      helper.runInTransaction(agent, withTransaction)
    }

    function withTransaction(transaction) {
      run(t, db, verify)

      function verify(names) {
        t.equal(agent.getTransaction(), transaction)
        var segment = agent.tracer.getSegment()
        var current = transaction.trace.root

        for (var i = 0, l = names.length; i < l; ++i) {
          t.equal(current.children.length, 1)
          current = current.children[0]
          t.equal(current.name, names[i])
        }

        t.equal(current, segment)
        t.end()
      }
    }
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
