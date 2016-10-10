'use strict'

var fs = require('fs')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
var urltils = require('../../../lib/util/urltils')

if (semver.satisfies(process.version, '0.8')) {
  console.log('The latest versions of the mongo driver are not compatible with v0.8')
  return
}

var DB_NAME = 'integration'
var MONGO_HOST = null
var MONGO_PORT = String(params.mongodb_port)
var BAD_MONGO_COMMANDS = [
  'collection'
]

mongoTest('open', [], function openTest(t, agent) {
  var mongodb = require('mongodb')
  var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
  var db = new mongodb.Db(DB_NAME, server)

  // TODO: Tighten this semver check once mongo resolves this bug:
  // https://jira.mongodb.org/browse/NODE-826
  var mongoPkg = require('mongodb/package')
  if (semver.satisfies(mongoPkg.version, '2.2.x')) {
    BAD_MONGO_COMMANDS.push('authenticate', 'logout')
  }

  helper.runInTransaction(agent, function inTransaction(transaction) {
    db.open(function onOpen(err, _db) {
      var segment = agent.tracer.getSegment()
      t.error(err)
      t.equal(db, _db, 'should pass through the arguments correctly')
      t.equal(agent.getTransaction(), transaction, 'should not lose tx state')
      t.equal(segment.name, 'Callback: onOpen', 'should create segments')
      t.equal(transaction.trace.root.children.length, 1, 'should only create one')
      var parent = transaction.trace.root.children[0]
      t.equal(
        parent.name, 'Datastore/operation/MongoDB/open',
        'should name segment correctly'
      )
      t.notEqual(parent.children.indexOf(segment), -1, 'should have callback as child')
      db.close()
      t.end()
    })
  })
})

dbTest('addUser, authenticate,  removeUser', [], function addUserTest(t, db, verify) {
  db.addUser('user-test', 'user-test-pass', {roles: ['readWrite']}, added)
  function added(err, user) {
    t.notOk(err, 'addUser should not have error')
    db.authenticate('user-test', 'user-test-pass', function authed(err2) {
      t.notOk(err2, 'authenticate should not have error')
      db.removeUser('user-test', function removed(err3) {
        t.notOk(err3, 'removeUser should not have error')
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
  }
})

dbTest('collection', ['testCollection'], function collectionTest(t, db, verify) {
  db.collection('testCollection', function gotCollection(err, collection) {
    t.notOk(err, 'should not have error')
    t.ok(collection, 'collection is not null')
    verify([
      'Datastore/operation/MongoDB/collection',
      'Callback: gotCollection',
    ])
  })
})

dbTest('collections', [], function collectionTest(t, db, verify) {
  db.collections(function gotCollections(err2, collections) {
    t.notOk(err2, 'should not have error')
    t.ok(Array.isArray(collections), 'got array of collections')
    verify([
      'Datastore/operation/MongoDB/collections',
      'Callback: gotCollections',
    ])
  })
})

dbTest('command', [], function commandTest(t, db, verify) {
  db.command({ping: 1}, function onCommand(err, result) {
   t.notOk(err, 'should not have error')
   t.deepEqual(result, {ok: 1}, 'got correct result')
   verify([
     'Datastore/operation/MongoDB/command',
     'Callback: onCommand',
   ])
 })
})

dbTest('createCollection', ['testCollection'], function createTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err, collection) {
    t.notOk(err, 'should not have error')
    t.equal(collection.s.name, 'testCollection',
      'new collection should have the right name')
    verify([
      'Datastore/operation/MongoDB/createCollection',
      'Callback: gotCollection',
    ])
  })
})

dbTest('createIndex', ['testCollection'], function createIndexTest(t, db, verify) {
  db.createIndex('testCollection', 'foo', function createdIndex(err, result) {
    t.notOk(err, 'should not have error')
    t.equal(result, 'foo_1', 'should have the right result')
    verify([
      'Datastore/operation/MongoDB/createIndex',
      'Callback: createdIndex',
    ])
  })
})

dbTest('dropCollection', ['testCollection'], function dropTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err) {
    t.notOk(err, 'should not have error getting collection')

    db.dropCollection('testCollection', function droppedCollection(err, result) {
      t.notOk(err, 'should not have error dropping colleciton')
      t.ok(result === true, 'result should be boolean true')
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
    t.notOk(err, 'should not have error')
    t.ok(result, 'result should be truthy')
    verify([
      'Datastore/operation/MongoDB/dropDatabase',
      'Callback: droppedDatabase',
    ])
  })
})

dbTest('ensureIndex', ['testCollection'], function ensureIndexTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err, result) {
    t.notOk(err, 'should not have error')
    t.equal(result, 'foo_1')
    verify([
      'Datastore/operation/MongoDB/ensureIndex',
      'Callback: ensuredIndex',
    ])
  })
})

dbTest('eval', [], function evalTest(t, db, verify) {
  db.eval('function (x) {return x;}', [3], function evaled(err, result) {
    t.notOk(err, 'should not have error')
    t.equal(3, result, 'should produce the right result')
    verify([
      'Datastore/operation/MongoDB/eval',
      'Callback: evaled',
    ])
  })
})

dbTest('indexInformation', ['testCollection'], function indexInfoTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err) {
    t.notOk(err, 'ensureIndex should not have error')
    db.indexInformation('testCollection', function gotInfo(err2, result) {
      t.notOk(err2, 'indexInformation should not have error')
      t.deepEqual(result, { _id_: [ [ '_id', 1 ] ], foo_1: [ [ 'foo', 1 ] ] },
        'result is the expected object')
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
    t.notOk(err, 'should not have error')
    verify([
      'Datastore/operation/MongoDB/logout',
      'Callback: loggedOut',
    ])
  })
})


dbTest('renameCollection', ['testColl', 'testColl2'], function(t, db, verify) {
  db.createCollection('testColl', function gotCollection(err) {
    t.notOk(err, 'should not have error getting collection')
    db.renameCollection('testColl', 'testColl2', function renamedCollection(err2) {
      t.notOk(err2, 'should not have error renaming collection')
      db.dropCollection('testColl2', function droppedCollection(err3) {
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

dbTest('stats', [], function statsTest(t, db, verify) {
  db.stats({}, function gotStats(err, stats) {
    t.notOk(err, 'should not have error')
    t.ok(stats, 'got stats')
    verify([
      'Datastore/operation/MongoDB/stats',
      'Callback: gotStats',
    ])
  })
})

function dbTest(name, collections, run) {
  mongoTest(name, collections, function init(t, agent) {
    var LOCALHOST = agent.config.getHostnameSafe()
    var domainPath = getDomainSocketPath()
    var mongodb = require('mongodb')
    var server = null
    var db = null

    t.autoend()

    t.test('remote connection', function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        MONGO_HOST = urltils.isLocalhost(params.mongodb_host)
          ? LOCALHOST
          : params.mongodb_host
        MONGO_PORT = String(params.mongodb_port)

        server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
        db = new mongodb.Db(DB_NAME, server)
        db.open(function onOpen(err) {
          if (err) {
            t.fail(err)
            return t.end()
          }

          done()
        })
      })

      t.afterEach(function(done) {
        db.close(done)
        db = null
      })

      t.test('without transaction', function(t) {
        run(t, db, function() {
          t.notOk(agent.getTransaction(), 'should not have transaction')
          t.end()
        })
      })

      t.test('with transaction', function(t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function(transaction) {
          run(t, db, function(names) {
            verifyMongoSegments(t, agent, transaction, names)
            transaction.end(function() {
              t.end()
            })
          })
        })
      })
    })

    t.test('domain socket', {skip: !domainPath}, function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        MONGO_HOST = LOCALHOST
        MONGO_PORT = domainPath

        server = new mongodb.Server(domainPath)
        db = new mongodb.Db(DB_NAME, server)
        db.open(done)
      })

      t.afterEach(function(done) {
        db.close(done)
        db = null
      })

      t.test('with transaction', function(t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function(transaction) {
          run(t, db, function(names) {
            verifyMongoSegments(t, agent, transaction, names)
            transaction.end(function() {
              t.end()
            })
          })
        })
      })
    })
  })
}

function mongoTest(name, collections, run) {
  tap.test(name, function testWrap(t) {
    helper.bootstrapMongoDB(collections, function bootstrapped(err) {
      if (err) {
        t.fail(err)
        return t.end()
      }

      run(t, helper.loadTestAgent(t))
    })
  })
}

function verifyMongoSegments(t, agent, transaction, names) {
  t.ok(agent.getTransaction(), 'should not lose transaction state')
  t.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  var segment = agent.tracer.getSegment()
  var current = transaction.trace.root

  for (var i = 0, l = names.length; i < l; ++i) {
    t.equal(current.children.length, 1, 'should have one child segment')
    current = current.children[0]
    t.equal(current.name, names[i], 'segment should be named ' + names[i])

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(current.name)) {
      if (isBadSegment(current)) {
        t.comment('Skipping attributes check for ' + current.name)
        continue
      }

      // TODO: Combine this with a semver check once mongo resolves this bug:
      // https://jira.mongodb.org/browse/NODE-827
      var dbName = DB_NAME
      if (/\/renameCollection$/.test(current.name)) {
        dbName = 'admin'
      }

      var parms = current.parameters
      t.equal(parms.database_name, dbName, 'should have correct db name')
      t.equal(parms.host, MONGO_HOST, 'should have correct host name')
      t.equal(parms.port_path_or_id, MONGO_PORT, 'should have correct port')
    }
  }

  // Do not use `t.equal` for this comparison. When it is false tap would dump
  // way too much information to be useful.
  t.ok(current === segment, 'current segment is ' + segment.name)
}

function isBadSegment(segment) {
  var nameParts = segment.name.split('/')
  var command = nameParts[nameParts.length - 1]
  var parms = segment.parameters

  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 && // Is in the list of bad commands
    !parms.hasOwnProperty('database_name') &&     // and does not have any of the
    !parms.hasOwnProperty('host') &&              // instance attributes.
    !parms.hasOwnProperty('port_path_or_id')
  )
}

function getDomainSocketPath() {
  var files = fs.readdirSync('/tmp')
  for (var i = 0; i < files.length; ++i) {
    var file = '/tmp/' + files[i]
    if (/^\/tmp\/mongodb.*?\.sock$/.test(file)) {
      return file
    }
  }
  return null
}
