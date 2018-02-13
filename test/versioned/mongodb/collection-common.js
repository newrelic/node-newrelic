'use strict'

var fs = require('fs')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
var urltils = require('../../../lib/util/urltils')

var MONGO_SEGMENT_RE = /^Datastore\/.*?\/MongoDB/
var TRANSACTION_NAME = 'mongo test'
var DB_NAME = 'integration'
var METRIC_HOST_NAME = null
var METRIC_HOST_PORT = null


exports.test = collectionTest
exports.MONGO_SEGMENT_RE = MONGO_SEGMENT_RE
exports.TRANSACTION_NAME = TRANSACTION_NAME
exports.DB_NAME = DB_NAME

function collectionTest(name, run) {
  var collections = ['testCollection', 'testCollection2']

  tap.test(name, {timeout: 10000}, function(t) {
    var agent = null
    var client = null
    var db = null
    var collection = null
    t.autoend()

    t.test('remote connection', function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        agent = helper.instrumentMockedAgent()
        helper.bootstrapMongoDB(collections, function(err) {
          if (err) {
            return done(err)
          }

          var mongodb = require('mongodb')
          var pkg = require('mongodb/package')

          METRIC_HOST_NAME = urltils.isLocalhost(params.mongodb_host)
            ? agent.config.getHostnameSafe()
            : params.mongodb_host
          METRIC_HOST_PORT = String(params.mongodb_port)

          var connector = semver.satisfies(pkg.version, '>=3')
            ? _connectV3
            : _connectV2

          connector(mongodb, null, function(err, res) {
            if (err) {
              return done(err)
            }

            client = res.client
            db = res.db
            collection = db.collection('testCollection')
            populate(db, collection, done)
          })
        })
      })

      t.afterEach(function(done) {
        _close(client, db, function(err) {
          helper.unloadAgent(agent)
          agent = null
          done(err)
        })
      })

      t.test('should not error outside of a transaction', function(t) {
        t.notOk(agent.getTransaction(), 'should not be in a transaction')
        run(t, collection, function(err) {
          t.error(err, 'running test should not error')
          t.notOk(agent.getTransaction(), 'should not somehow gain a transaction')
          t.end()
        })
      })

      t.test('should generate the correct metrics and segments', function(t) {
        helper.runInTransaction(agent, function(transaction) {
          transaction.name = TRANSACTION_NAME
          run(t, collection, function(err, segments, metrics) {
            if (
              !t.error(err, 'running test should not error') ||
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

            t.equal(current.children.length, 0, 'should have no more children')
            t.ok(current === segment, 'should test to the current segment')

            transaction.end(function onTxEnd() {
              checkMetrics(t, agent, metrics || [])
              t.end()
            })
          })
        })
      })

      t.test('should respect `datastore_tracer.instance_reporting`', function(t) {
        agent.config.datastore_tracer.instance_reporting.enabled = false
        helper.runInTransaction(agent, function(tx) {
          run(t, collection, function(err) {
            if (!t.error(err, 'running test should not error')) {
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

      t.test('should respect `datastore_tracer.database_name_reporting`', function(t) {
        agent.config.datastore_tracer.database_name_reporting.enabled = false
        helper.runInTransaction(agent, function(tx) {
          run(t, collection, function(err) {
            if (!t.error(err, 'running test should not error')) {
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

    // The domain socket tests should only be run if there is a domain socket
    // to connect to, which only happens if there is a Mongo instance running on
    // the same box as these tests. This should always be the case on Travis,
    // but just to be sure they're running there check for the environment flag.
    var domainPath = getDomainSocketPath()
    var shouldTestDomain = domainPath || process.env.TRAVIS
    t.test('domain socket', {skip: !shouldTestDomain}, function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        agent = helper.instrumentMockedAgent()
        METRIC_HOST_NAME = agent.config.getHostnameSafe()
        METRIC_HOST_PORT = domainPath
        helper.bootstrapMongoDB(collections, function(err) {
          if (err) {
            return done(err)
          }

          var mongodb = require('mongodb')
          var pkg = require('mongodb/package')
          var connector = semver.satisfies(pkg.version, '>=3')
            ? _connectV3
            : _connectV2

          connector(mongodb, domainPath, function(err, res) {
            if (err) {
              return done(err)
            }

            client = res.client
            db = res.db

            collection = db.collection('testCollection')
            populate(db, collection, done)
          })
        })
      })

      t.afterEach(function(done) {
        _close(client, db, function(err) {
          helper.unloadAgent(agent)
          agent = null
          done(err)
        })
      })

      t.test('should have domain socket in metrics', function(t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function(transaction) {
          transaction.name = TRANSACTION_NAME
          run(t, collection, function(err, segments, metrics) {
            t.error(err)
            transaction.end(function() {
              var re = new RegExp('^Datastore/instance/MongoDB/' + domainPath)
              var badMetrics = Object.keys(agent.metrics.unscoped).filter(function(m) {
                return re.test(m)
              })
              t.notOk(badMetrics.length, 'should not use domain path as host name')
              checkMetrics(t, agent, metrics || [])
              t.end()
            })
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

  if (!t.ok(scoped, 'should have scoped metrics')) {
    return
  }
  t.equal(Object.keys(agent.metrics.scoped).length, 1, 'should have one metric scope')
  for (var i = 0; i < metrics.length; ++i) {
    var count = null
    var name = null

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
      'unscoped operation metric should be called ' + count + ' times'
    )
    t.equal(
      unscopedMetrics['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'unscoped statement metric should be called ' + count + ' times'
    )
    t.equal(
      scoped['Datastore/statement/MongoDB/testCollection/' + name].callCount,
      count,
      'scoped statement metric should be called ' + count + ' times'
    )
  }

  var expectedUnscopedCount = 5 + (2 * metrics.length)
  t.equal(
    unscopedNames.length, expectedUnscopedCount,
    'should have ' + expectedUnscopedCount + ' unscoped metrics'
  )
  var expectedUnscopedMetrics = [
    'Datastore/all',
    'Datastore/allWeb',
    'Datastore/MongoDB/all',
    'Datastore/MongoDB/allWeb',
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

  db.collection('testCollection2').drop(function() {
    collection.deleteMany({}, function(err) {
      if (err) return done(err)
      collection.insert(items, done)
    })
  })
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

function _connectV2(mongodb, path, cb) {
  var server = null
  if (path) {
    server = new mongodb.Server(path)
  } else {
    server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {
      socketOptions: {
        connectionTimeoutMS: 30000,
        socketTimeoutMS: 30000
      }
    })
  }

  var db = new mongodb.Db(DB_NAME, server)

  db.open(function(err) {
    cb(err, {db: db, client: null})
  })
}

function _connectV3(mongodb, host, cb) {
  if (host) {
    host = encodeURIComponent(host)
  } else {
    host = params.mongodb_host + ':' + params.mongodb_port
  }
  mongodb.MongoClient.connect('mongodb://' + host, function(err, client) {
    if (err) {
      return cb(err)
    }

    var db = client.db(DB_NAME)
    cb(null, {db: db, client: client})
  })
}

function _close(client, db, cb) {
  if (db && typeof db.close === 'function') {
    db.close(cb)
  } else if (client) {
    client.close(true, cb)
  } else {
    cb()
  }
}
