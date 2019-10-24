'use strict'

var common = require('./common')
const collectionCommon = require('./collection-common')
var helper = require('../../lib/agent_helper')
var mongoPackage = require('mongodb/package.json')
var params = require('../../lib/params')
var semver = require('semver')
var tap = require('tap')

var MONGO_HOST = null
var MONGO_PORT = null
var BAD_MONGO_COMMANDS = [
  'collection'
]

if (semver.satisfies(mongoPackage.version, '<3')) {
  mongoTest('open', [], function openTest(t, agent) {
    var mongodb = require('mongodb')
    var server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
    var db = new mongodb.Db(common.DB_NAME, server)

    // TODO: Tighten this semver check once mongo resolves this bug:
    // https://jira.mongodb.org/browse/NODE-826
    if (semver.satisfies(mongoPackage.version, '2.2.x')) {
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

  dbTest('logout', [], function logoutTest(t, db, verify) {
    db.logout({}, function loggedOut(err) {
      t.error(err, 'should not have error')
      verify([
        'Datastore/operation/MongoDB/logout',
        'Callback: loggedOut',
      ])
    })
  })
}

dbTest('addUser, authenticate, removeUser', [], function addUserTest(t, db, verify) {
  var user = null
  var userName = 'user-test'
  var userPass = 'user-test-pass'

  db.removeUser(userName, function preRemove() {
    // Don't care if this first remove fails, it's just to ensure a clean slate.
    db.addUser(userName, userPass, {roles: ['readWrite']}, added)
  })

  function added(err, _user) {
    if (!t.error(err, 'addUser should not have error')) {
      return t.end()
    }
    user = _user

    if (typeof db.authenticate === 'function') {
      db.authenticate(userName, userPass, authed)
    } else {
      t.comment('Skipping authentication test, not supported on db')
      db.removeUser(userName, removedNoAuth)
    }
  }

  function authed(err) {
    if (!t.error(err, 'authenticate should not have error')) {
      return t.end()
    }
    db.removeUser(userName, removed)
  }

  function removed(err) {
    if (!t.error(err, 'removeUser should not have error')) {
      return t.end()
    }
    t.equal(user[0].user, userName)
    verify([
      'Datastore/operation/MongoDB/removeUser',
      'Callback: preRemove',
      'Datastore/operation/MongoDB/addUser',
      'Callback: added',
      'Datastore/operation/MongoDB/authenticate',
      'Callback: authed',
      'Datastore/operation/MongoDB/removeUser',
      'Callback: removed'
    ])
  }

  function removedNoAuth(err) {
    if (!t.error(err, 'removeUser should not have error')) {
      return t.end()
    }
    t.equal(user[0].user, userName)
    verify([
      'Datastore/operation/MongoDB/removeUser',
      'Callback: preRemove',
      'Datastore/operation/MongoDB/addUser',
      'Callback: added',
      'Datastore/operation/MongoDB/removeUser',
      'Callback: removedNoAuth'
    ])
  }
})

dbTest('collection', ['testCollection'], function collectionTest(t, db, verify) {
  db.collection('testCollection', function gotCollection(err, collection) {
    t.error(err, 'should not have error')
    t.ok(collection, 'collection is not null')
    verify([
      'Datastore/operation/MongoDB/collection',
      'Callback: gotCollection',
    ])
  })
})

dbTest('collections', [], function collectionTest(t, db, verify) {
  db.collections(function gotCollections(err2, collections) {
    t.error(err2, 'should not have error')
    t.ok(Array.isArray(collections), 'got array of collections')
    verify([
      'Datastore/operation/MongoDB/collections',
      'Callback: gotCollections',
    ])
  })
})

dbTest('command', [], function commandTest(t, db, verify) {
  db.command({ping: 1}, function onCommand(err, result) {
    t.error(err, 'should not have error')
    t.deepEqual(result, {ok: 1}, 'got correct result')
    verify([
      'Datastore/operation/MongoDB/command',
      'Callback: onCommand',
    ])
  })
})

dbTest('createCollection', ['testCollection'], function createTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err, collection) {
    t.error(err, 'should not have error')
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
    t.error(err, 'should not have error')
    t.equal(result, 'foo_1', 'should have the right result')
    verify([
      'Datastore/operation/MongoDB/createIndex',
      'Callback: createdIndex',
    ])
  })
})

dbTest('dropCollection', ['testCollection'], function dropTest(t, db, verify) {
  db.createCollection('testCollection', function gotCollection(err) {
    t.error(err, 'should not have error getting collection')

    db.dropCollection('testCollection', function droppedCollection(err, result) {
      t.error(err, 'should not have error dropping colleciton')
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
    t.error(err, 'should not have error')
    t.ok(result, 'result should be truthy')
    verify([
      'Datastore/operation/MongoDB/dropDatabase',
      'Callback: droppedDatabase',
    ])
  })
})

dbTest('ensureIndex', ['testCollection'], function ensureIndexTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err, result) {
    t.error(err, 'should not have error')
    t.equal(result, 'foo_1')
    verify([
      'Datastore/operation/MongoDB/ensureIndex',
      'Callback: ensuredIndex',
    ])
  })
})

dbTest('eval', [], function evalTest(t, db, verify) {
  db.eval('function (x) {return x;}', [3], function evaled(err, result) {
    t.error(err, 'should not have error')
    t.equal(3, result, 'should produce the right result')
    verify([
      'Datastore/operation/MongoDB/eval',
      'Callback: evaled',
    ])
  })
})

dbTest('indexInformation', ['testCollection'], function indexInfoTest(t, db, verify) {
  db.ensureIndex('testCollection', 'foo', function ensuredIndex(err) {
    t.error(err, 'ensureIndex should not have error')
    db.indexInformation('testCollection', function gotInfo(err2, result) {
      t.error(err2, 'indexInformation should not have error')
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

dbTest('renameCollection', ['testColl', 'testColl2'], function(t, db, verify) {
  db.createCollection('testColl', function gotCollection(err) {
    t.error(err, 'should not have error getting collection')
    db.renameCollection('testColl', 'testColl2', function renamedCollection(err2) {
      t.error(err2, 'should not have error renaming collection')
      db.dropCollection('testColl2', function droppedCollection(err3) {
        t.error(err3)
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
    t.error(err, 'should not have error')
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
    var domainPath = common.getDomainSocketPath()
    var mongodb = require('mongodb')
    var db = null
    var client = null

    t.autoend()

    t.test('remote connection', function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        MONGO_HOST = common.getHostName(agent)
        MONGO_PORT = common.getPort()

        common.connect(mongodb, null, function(err, res) {
          client = res.client
          db = res.db
          done(err)
        })
      })

      t.afterEach(function(done) {
        common.close(client, db, done)
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
            transaction.end()
            t.end()
          })
        })
      })
    })

    // The domain socket tests should only be run if there is a domain socket
    // to connect to, which only happens if there is a Mongo instance running on
    // the same box as these tests. This should always be the case on Travis,
    // but just to be sure they're running there check for the environment flag.
    var shouldTestDomain = domainPath || process.env.TRAVIS
    t.test('domain socket', {skip: !shouldTestDomain}, function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        MONGO_HOST = LOCALHOST
        MONGO_PORT = domainPath

        common.connect(mongodb, domainPath, function(err, res) {
          client = res.client
          db = res.db
          done(err)
        })
      })

      t.afterEach(function(done) {
        common.close(client, db, done)
      })

      t.test('with transaction', function(t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function(transaction) {
          run(t, db, function(names) {
            verifyMongoSegments(t, agent, transaction, names)
            transaction.end()
            t.end()
          })
        })
      })
    })
  })
}

function mongoTest(name, collections, run) {
  tap.test(name, function testWrap(t) {
    const mongodb = require('mongodb')
    collectionCommon.dropTestCollections(mongodb, collections, (err) => {
      if (!t.error(err)) {
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

      // Commands known as "admin commands" always happen against the "admin"
      // database regardless of the DB the connection is actually connected to.
      // This is apparently by design.
      // https://jira.mongodb.org/browse/NODE-827
      var dbName = common.DB_NAME
      if (/\/renameCollection$/.test(current.name)) {
        dbName = 'admin'
      }

      var attributes = current.getAttributes()
      t.equal(attributes.database_name, dbName, 'should have correct db name')
      t.equal(attributes.host, MONGO_HOST, 'should have correct host name')
      t.equal(attributes.port_path_or_id, MONGO_PORT, 'should have correct port')
      t.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }

  // Do not use `t.equal` for this comparison. When it is false tap would dump
  // way too much information to be useful.
  t.ok(current === segment, 'current segment is ' + segment.name)
}

function isBadSegment(segment) {
  var nameParts = segment.name.split('/')
  var command = nameParts[nameParts.length - 1]
  var attributes = segment.getAttributes()

  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 && // Is in the list of bad commands
    !attributes.database_name &&                  // and does not have any of the
    !attributes.host &&                           // instance attributes.
    !attributes.port_path_or_id
  )
}
