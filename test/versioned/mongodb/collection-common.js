/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var common = require('./common')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
const async = require('async')

var METRIC_HOST_NAME = null
var METRIC_HOST_PORT = null


exports.MONGO_SEGMENT_RE = common.MONGO_SEGMENT_RE
exports.TRANSACTION_NAME = common.TRANSACTION_NAME
exports.DB_NAME = common.DB_NAME

exports.connect = common.connect
exports.close = common.close
exports.populate = populate
exports.test = collectionTest

exports.dropTestCollections = dropTestCollections

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

        var mongodb = require('mongodb')

        dropTestCollections(mongodb, collections, function(err) {
          if (err) {
            return done(err)
          }

          METRIC_HOST_NAME = common.getHostName(agent)
          METRIC_HOST_PORT = common.getPort()
          common.connect(mongodb, null, function(err, res) {
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
        common.close(client, db, function(err) {
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
          transaction.name = common.TRANSACTION_NAME
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
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                checkSegmentParams(t, current)
              }
            }

            t.equal(current.children.length, 0, 'should have no more children')
            t.ok(current === segment, 'should test to the current segment')

            transaction.end()
            common.checkMetrics(
              t,
              agent,
              METRIC_HOST_NAME,
              METRIC_HOST_PORT,
              metrics || []
            )
            t.end()
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
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                t.comment('Checking segment ' + current.name)
                const attributes = current.getAttributes()
                t.notOk(
                  attributes.host,
                  'should not have host attribute'
                )
                t.notOk(
                  attributes.port_path_or_id,
                  'should not have port attribute'
                )
                t.ok(
                  attributes.database_name,
                  'should have database name attribute'
                )
                t.ok(
                  attributes.product,
                  'should have product attribute'
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
              if (common.MONGO_SEGMENT_RE.test(current.name)) {
                t.comment('Checking segment ' + current.name)
                const attributes = current.getAttributes()
                t.ok(
                  attributes.host,
                  'should have host attribute'
                )
                t.ok(
                  attributes.port_path_or_id,
                  'should have port attribute'
                )
                t.notOk(
                  attributes.database_name,
                  'should not have database name attribute'
                )
                t.ok(
                  attributes.product,
                  'should have product attribute'
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
    var domainPath = common.getDomainSocketPath()
    var shouldTestDomain = domainPath || process.env.TRAVIS
    t.test('domain socket', {skip: !shouldTestDomain}, function(t) {
      t.autoend()
      t.beforeEach(function(done) {
        agent = helper.instrumentMockedAgent()
        METRIC_HOST_NAME = agent.config.getHostnameSafe()
        METRIC_HOST_PORT = domainPath

        var mongodb = require('mongodb')

        dropTestCollections(mongodb, collections, function(err) {
          if (err) {
            return done(err)
          }

          common.connect(mongodb, domainPath, function(err, res) {
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
        common.close(client, db, function(err) {
          helper.unloadAgent(agent)
          agent = null
          done(err)
        })
      })

      t.test('should have domain socket in metrics', function(t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function(transaction) {
          transaction.name = common.TRANSACTION_NAME
          run(t, collection, function(err, segments, metrics) {
            t.error(err)
            transaction.end()
            var re = new RegExp('^Datastore/instance/MongoDB/' + domainPath)
            var badMetrics = Object.keys(agent.metrics._metrics.unscoped)
              .filter(function(m) {
                return re.test(m)
              })
            t.notOk(badMetrics.length, 'should not use domain path as host name')
            common.checkMetrics(
              t,
              agent,
              METRIC_HOST_NAME,
              METRIC_HOST_PORT,
              metrics || []
            )
            t.end()
          })
        })
      })
    })
  })
}

function checkSegmentParams(t, segment) {
  var dbName = common.DB_NAME
  if (/\/rename$/.test(segment.name)) {
    dbName = 'admin'
  }

  var attributes = segment.getAttributes()
  t.equal(attributes.database_name, dbName, 'should have correct db name')
  t.equal(attributes.host, METRIC_HOST_NAME, 'should have correct host name')
  t.equal(attributes.port_path_or_id, METRIC_HOST_PORT, 'should have correct port')
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

/**
 * Bootstrap a running MongoDB instance by dropping all the collections used
 * by tests.
 * @param {*} mongodb MongoDB module to execute commands on.
 * @param {*} collections Collections to drop for test.
 * @param {Function} callback The operations to be performed while the server
 *                     is running.
 */
function dropTestCollections(mongodb, collections, callback) {
  common.connect(mongodb, null, function(err, res) {
    if (err) {
      return callback(err)
    }

    const client = res.client
    const db = res.db

    async.eachSeries(collections, (collection, cb) => {
      db.dropCollection(collection, (err) => {
        // It's ok if the collection didn't exist before
        if (err && err.errmsg === 'ns not found') {
          err = null
        }

        cb(err)
      })
    }, (err) => {
      common.close(client, db, (err2) => {
        callback(err || err2)
      })
    })
  })
}
