'use strict'

var fs = require('fs')
var tap = require('tap')
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var semver = require('semver')
var urltils = require('../../../lib/util/urltils')

/*
 *
 * CONSTANTS
 *
 */

// centrally control how long we're willing to wait for mongo
var SLUG_FACTOR = 30000
var OPTS = { timeout: SLUG_FACTOR }

var DB_NAME = 'integration'
var COLLECTION = 'test_1_3_19_plus'
var MONGO_HOST = null
var MONGO_PORT = String(params.mongodb_port)
var METRICS_VERIFIER_COUNT = 5
var TRACE_VERIFIER_COUNT = 10

/* eslint-disable max-params */
function addMetricsVerifier(t, agent, operation, calls, host, port) {
  /* eslint-enable max-params */
  host = host || MONGO_HOST || 'localhost'
  port = port || MONGO_PORT
  if (urltils.isLocalhost(host)) {
    host = agent.config.getHostnameSafe()
  }

  agent.once('transactionFinished', function() {
    t.comment('metrics verifier start')
    try {
      t.equals(
        agent.metrics.getMetric('Datastore/all').callCount,
        calls || 1,
        'should find all operations'
      )
      t.equals(
        agent.metrics.getMetric('Datastore/allWeb').callCount,
        calls || 1,
        'should find all operations'
      )
      t.equals(
        agent.metrics.getMetric('Datastore/operation/MongoDB/' + operation).callCount,
        calls || 1,
        'generic ' + operation + ' should be recorded'
      )
      t.equals(
        agent.metrics.getMetric(
          'Datastore/statement/MongoDB/' + COLLECTION + '/' + operation
        ).callCount,
        calls || 1,
        'named collection ' + operation + ' should be recorded'
      )
      t.equals(
        agent.metrics.getMetric(
          'Datastore/instance/MongoDB/' + host + '/' + port
        ).callCount,
        calls || 1,
        'should find all calls to the local instance'
      )
    } catch (error) {
      t.error(error.stack)
      t.end()
    }
    t.comment('metrics verifier complete')
  })
}

/* eslint-disable max-params */
function verifyTrace(t, segment, operation, host, port, done) {
  /* eslint-enable max-params */
  t.comment('verifyTrace start')
  if (host instanceof Function) {
    // verifyTrace(t, segment, operation, done)
    done = host
    host = null
    port = null
  }

  host = host || MONGO_HOST
  port = port || MONGO_PORT
  if (urltils.isLocalhost(host)) {
    host = segment.transaction.agent.config.getHostnameSafe()
  }

  try {
    var transaction = segment.transaction
    var trace = transaction.trace
    t.ok(trace, 'trace should exist.')
    t.ok(trace.root, 'root element should exist.')
    t.ok(trace.root.children[0], 'should have a child.')
    var op_segment = segment.parent

    t.ok(op_segment, 'trace segment for ' + operation + ' should exist')
    t.equal(
      op_segment.name,
      'Datastore/statement/MongoDB/' + COLLECTION + '/' + operation,
      'should register the ' + operation
    )
    t.equal(
      op_segment.parameters.host,
      host,
      'should have correct host parameter'
    )
    t.equal(
      op_segment.parameters.port_path_or_id,
      port,
      'should have correct port_path_or_id parameter'
    )
    t.equal(
      op_segment.parameters.database_name,
      DB_NAME,
      'should have correct database_name parameter'
    )
    t.ok(op_segment.children.length > 0, 'should have at least one child')
    t.ok(op_segment._isEnded(), 'should have ended')
  } catch (error) {
    t.error(error)
    t.end()
  }

  // done and done!
  t.comment('verifyTrace complete')
  done && done()
}

// +5 asserts
function verifyNoStats(t, agent, operation) {
  try {
    var metrics = agent.metrics
    t.notOk(metrics.getMetric('Datastore/all'), 'should find no operations')
    t.notOk(metrics.getMetric('Datastore/allWeb'), 'should find no other operations')
    t.notOk(
      metrics.getMetric('Datastore/operation/MongoDB/' + operation),
      'generic ' + operation + ' should not be recorded'
    )
    t.notOk(
      metrics.getMetric('Datastore/statement/MongoDB/' + COLLECTION + '/' + operation),
     'MongoDB ' + operation + ' should not be recorded'
   )
    t.notOk(
      metrics.getMetric(
        'Datastore/instance/MongoDB/' + MONGO_HOST + '/' + MONGO_PORT
      ),
      'should find no calls to the local instance'
    )
  } catch (error) {
    t.fail(error)
    t.end()
  }
}

function runWithDB(t, callback) {
  var mongodb = require('mongodb')
  var server = new mongodb.Server(params.mongodb_host, params.mongodb_port, {
    auto_reconnect: true
  })
  var db = new mongodb.Db(DB_NAME, server, {w: 1, safe: true})


  t.tearDown(function() {
    db.close(true, function(error) {
      if (error) t.error(error)
    })
  })

  db.open(function(error) {
    if (error) {
      t.error(error)
      return t.end()
    }

    db.createCollection(COLLECTION, {safe: false}, function(error, collection) {
      if (error) {
        t.error(error)
        return t.end()
      }

      callback(collection)
    })
  })
}

function runWithoutTransaction(t, callback) {
  // need an agent before connecting to MongoDB so the module loader gets patched
  var agent = helper.instrumentMockedAgent()
  MONGO_HOST = urltils.isLocalhost(params.mongodb_host)
    ? agent.config.getHostnameSafe()
    : params.mongodb_host
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })
  runWithDB(t, function(collection) {
    callback(agent, collection)
  })
}

function runWithTransaction(t, callback) {
  runWithoutTransaction(t, function(agent, collection) {
    helper.runInTransaction(agent, function(transaction) {
      callback(agent, collection, transaction)
    })
  })
}

/**
 * TESTS
 */
tap.test('agent instrumentation of node-mongodb-native', function(t) {
  helper.bootstrapMongoDB([COLLECTION], function cb_bootstrapMongoDB(err) {
    if (err) t.fail(err)
    t.autoend()

    t.test('insert', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)
        runWithTransaction(t, function(agent, collection, transaction) {
          addMetricsVerifier(t, agent, 'insert')

          var hunx = {id: 1, hamchunx: 'verbloks'}
          collection.insert(hunx, {w: 1}, function(error, result) {
            if (error) t.fail(error)

            t.ok(result, 'should have gotten back results')
            t.ok(agent.getTransaction(), 'transaction should still be visible')

            process.nextTick(function() {
              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'insert')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.plan(7)

        runWithoutTransaction(t, function(agent, collection) {
          var hunx = {id: 3, hamchunx: 'caramel'}
          collection.insert(hunx, {w: 1}, function(error, result) {
            if (error) t.fail(error)

            t.ok(result, 'should have gotten back results')
            t.notOk(agent.getTransaction(), 'should be not transaction in play')

            setTimeout(function() {
              verifyNoStats(t, agent, 'insert')
            }, 100)
          })
        })
      })
    })

    t.test('find', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()

        t.test('with selector, with callback, then toArray', OPTS, function(t) {
          t.plan(4 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'toArray')

            collection.find({id: 1337}, function(error, cursor) {
              if (error) t.fail(error)

              t.ok(cursor, 'should have gotten back cursor')
              t.ok(agent.getTransaction(), 'transaction should still be visible')

              cursor.toArray(function(error, result) {
                if (error) t.fail(error)

                t.ok(result, 'should have gotten back results')
                t.ok(agent.getTransaction(), 'transaction should still be visible')

                transaction.end()
                verifyTrace(t, agent.tracer.getSegment(), 'toArray')
              })
            })
          })
        })

        t.test('without selector, then toArray', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'toArray')

            var cursor = collection.find()
            cursor.toArray(function cb_toArray(error, result) {
              if (error) t.fail(error)

              t.ok(result, 'should have gotten back results')
              t.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'toArray')
            })
          })
        })

        t.test('with selector, then each', OPTS, function(t) {
          t.plan(3 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'each')

            var cursor = collection.find()
            cursor.each(function(error, result) {
              if (error) t.fail(error)

              // When result is null we've exhausted all results

              if (result !== null) {
                return t.ok(result, 'should get 2 results (for t.plan count)')
              }
              t.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'each')
            })
          })
        })

        t.test('with selector, then nextObject to exhaustion', OPTS, function(t) {
          t.plan(5 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'nextObject', 3)
            var cursor = collection.find()
            function cb(error, result) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')

              if (result) {
                t.ok(result, 'should have gotten back results')
                cursor.nextObject(cb)
              } else {
                process.nextTick(function() {
                  transaction.end(t.end.bind(t))
                  verifyTrace(t, agent.tracer.getSegment(), 'nextObject')
                })
              }
            }

            cursor.nextObject(cb)
          })
        })

        t.test('with selector, then nextObject, then close', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'nextObject')

            var cursor = collection.find()
            cursor.nextObject(function(error, result) {
              if (error) t.fail(error)

              t.ok(result, 'should have gotten back results')
              cursor.close()

              t.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'nextObject')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.find({id: 1337}, function(error, result) {
              if (error) t.fail(error)

              t.ok(result, 'should have gotten back results')
              t.notOk(agent.getTransaction(), 'should be no transaction')

              setTimeout(function() {
                verifyNoStats(t, agent, 'find')
              }, 100)
            })
          })
        })

        t.test('with Cursor', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            var cursor = collection.find({id: 1337})
            cursor.toArray(function(error, result) {
              if (error) t.fail(error)

              t.ok(result, 'should have gotten back results')
              t.notOk(agent.getTransaction(), 'should be no transaction')

              setTimeout(function() {
                verifyNoStats(t, agent, 'find')
              }, 100)
            })
          })
        })
      })
    })

    t.test('findOne', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('findOne requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'findOne')

            collection.findOne({id: 1337}, function(error, result) {
              if (error) t.fail(error)

              t.notOk(result, 'shouldn\'t have gotten back nonexistent result')
              t.ok(agent.getTransaction(), 'transaction should still be visible')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'findOne')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('findOne requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.findOne({id: 1337}, function(error, result) {
              if (error) t.fail(error)

              t.notOk(result, 'shouldn\'t have gotten back nonexistent result')
              t.notOk(agent.getTransaction(), 'should be no transaction')

              setTimeout(function() {
                verifyNoStats(t, agent, 'find')
              }, 100)
            })
          })
        })
      })
    })

    t.test('findAndModify', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('findAndModify requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(3 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'findAndModify')

            collection.findAndModify(
              { hamchunx: {$exists: true} },
              [['id', 1]],
              { $set: {__findAndModify: true} },
              { new: true },
              cb
            )

            function cb(error, doc) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')

              t.ok(doc, 'should have gotten back the modified document')
              t.ok(doc.__findAndModify, 'have evidence of modification')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'findAndModify')
            }
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('findAndModify requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(8)

          runWithoutTransaction(t, function(agent, collection) {
            collection.findAndModify(
              { hamchunx: {$exists: true} },
              [['id', 1]],
              { $set: {__findAndModify: true} },
              { new: true },
              cb
            )

            function cb(error, doc) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should be no transaction')
              t.ok(doc, 'should have gotten back the modified document')
              t.ok(doc.__findAndModify, 'have evidence of modification')

              verifyNoStats(t, agent, 'findAndModify')
            }
          })
        })
      })
    })

    t.test('findAndRemove', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('findAndRemove requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(3 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithDB(t, function(collection) {
            var it0rm = {id: 876, bornToDie: 'young'}
            collection.insert(it0rm, function(error) {
              if (error) t.fail(error)

              runWithTransaction(t, function(agent, collection, transaction) {
                addMetricsVerifier(t, agent, 'findAndRemove')

                collection.findAndRemove(
                  { bornToDie: {$exists: true} },
                  [['id', 1]],
                  cb
                )

                function cb(error, doc) {
                  if (error) t.fail(error)

                  t.ok(agent.getTransaction(), 'transaction should still be visible')
                  t.ok(doc, 'should have gotten back the removed document')
                  t.equal(doc.id, 876, 'should have evidence of removal')

                  transaction.end()
                  verifyTrace(t, agent.tracer.getSegment(), 'findAndRemove')
                }
              })
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('findAndRemove requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(8)

          runWithDB(t, function(collection) {
            var it0rm = {id: 987, bornToDie: 'young'}
            collection.insert(it0rm, function(error) {
              if (error) t.fail(error)

              runWithoutTransaction(t, function(agent, collection) {
                collection.findAndRemove(
                  { bornToDie: {$exists: true} },
                  [['id', 1]],
                  cb
                )

                function cb(error, doc) {
                  if (error) t.fail(error)

                  t.notOk(agent.getTransaction(), 'should have no transaction')
                  t.ok(doc, 'should have gotten back the removed document')
                  t.equal(doc.id, 987, 'should have evidence of removal')

                  verifyNoStats(t, agent, 'findAndRemove')
                }
              })
            })
          })
        })
      })
    })

    t.test('update', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

        runWithTransaction(t, function(agent, collection, transaction) {
          addMetricsVerifier(t, agent, 'update')

          collection.update(
            { hamchunx: {$exists: true} },
            { $set: {__updatedWith: 'yup'} },
            { safe: true, multi: true },
            cb
          )

          function cb(error, numberModified) {
            if (error) t.fail(error)

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.equal(numberModified, 2, 'should have modified 2 documents')
            transaction.end()

            verifyTrace(t, agent.tracer.getSegment(), 'update')
          }
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.update(
              { hamchunx: {$exists: true} },
              { $set: {__updatedWithout: 'yup'} },
              { safe: true, multi: true },
              cb
            )
            function cb(error, numberModified) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should be no transaction')
              t.equal(numberModified, 2, 'should have modified 2 documents')

              verifyNoStats(t, agent, 'update')
            }
          })
        })

        t.test('with no callback (w = 0)', OPTS, function(t) {
          t.plan(10)

          runWithoutTransaction(t, function(agent, collection) {
            collection.update(
              { hamchunx: {$exists: true} },
              { $set: {__updatedWithout: 'yup'} }
            )

            setTimeout(function() {
              collection.find({__updatedWithout: 'yup'}).toArray(function(error, docs) {
                if (error) t.fail(error)

                t.notOk(agent.getTransaction(), 'should be no transaction')
                t.ok(docs, 'should have gotten back results')
                t.equal(docs.length, 2, 'should have found 2 modified')
                docs.forEach(function(doc) {
                  t.ok(doc.hamchunx, 'expected value found')
                })

                verifyNoStats(t, agent, 'update')
              })
            }, 100)
          })
        })
      })
    })

    t.test('save', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.plan(4 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

        runWithTransaction(t, function(agent, collection, transaction) {
          addMetricsVerifier(t, agent, 'save')

          var saved = {id: 999, oneoff: 'broccoli', __saved: true}
          collection.save(saved, {w: 1}, function(error, result) {
            if (error) t.fail(error)

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(result, 'should have the saved document')
            t.ok(result._id, 'should have evidence that it saved')
            t.ok(result.__saved, 'should have evidence we got our original document')

            process.nextTick(function() {
              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'save')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()

        t.test('with callback', OPTS, function(t) {
          t.plan(9)

          runWithoutTransaction(t, function(agent, collection) {
            var saved = {id: 888, oneoff: 'daikon', __saved: true}
            collection.save(saved, {w: 1}, function(error, result) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.ok(result, 'should have the saved document')
              t.ok(result._id, 'should have evidence that it saved')
              t.ok(result.__saved, 'should have evidence we got our original document')

              verifyNoStats(t, agent, 'insert')
            })
          })
        })

        t.test('with no callback (w = 0)', OPTS, function(t) {
          t.plan(8)

          runWithoutTransaction(t, function(agent, collection) {
            var saved = {id: 444, oneoff: 'radicchio', __saved: true}
            collection.save(saved, function() {
               collection.find({oneoff: 'radicchio'}).toArray(function(error, docs) {
                if (error) t.fail(error)

                t.notOk(agent.getTransaction(), 'should be no transaction')
                t.equal(docs.length, 1, 'should have only found one document')
                t.equal(docs[0].id, 444, 'should have evidence it\'s the same document')

                verifyNoStats(t, agent, 'insert')
              })
            })
          })
        })
      })
    })

    t.test('count', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

        runWithTransaction(t, function(agent, collection, transaction) {
          addMetricsVerifier(t, agent, 'count')

          collection.count(function(error, count) {
            if (error) t.fail(error)

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.equal(count, 5, 'should have found 5 documents')

            transaction.end()
            verifyTrace(t, agent.tracer.getSegment(), 'count')
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('count requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.count(function(error, count) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(count, 5, 'should have found 5 documents')

              verifyNoStats(t, agent, 'count')
            })
          })
        })
      })
    })

    t.test('distinct', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('distinct requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'distinct')

            collection.distinct('id', function(error, distinctSet) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.equal(distinctSet.length, 5, 'should have found 5 documents')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'distinct')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('distinct requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.distinct('id', function(error, distinctSet) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(distinctSet.length, 5, 'should have found 5 documents')

              verifyNoStats(t, agent, 'distinct')
            })
          })
        })
      })
    })

    t.test('createIndex', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('createIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'createIndex')

            collection.createIndex('id', function(error, name) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              // mongodb v1.0 returns `null`
              var expected = name ? 'id_1' : null
              t.equal(name, expected, 'should have created an index')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'createIndex')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('createIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.createIndex('id', function(error, name) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              // mongodb v1.0 returns `null`
              var expected = name ? 'id_1' : null
              t.equal(name, expected, 'should have created another index')

              verifyNoStats(t, agent, 'createIndex')
            })
          })
        })
      })
    })

    t.test('ensureIndex', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('ensureIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'ensureIndex')

            collection.ensureIndex('id', function(error, name) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.equal(name, 'id_1', 'should have found an index')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'ensureIndex')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('ensureIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.ensureIndex('id', function(error, name) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(name, 'id_1', 'should have created another index')

              verifyNoStats(t, agent, 'ensureIndex')
            })
          })
        })
      })
    })

    t.test('reIndex', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('reIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'reIndex')

            collection.reIndex(function(error, result) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.equal(result, true, 'should have found an index')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'reIndex')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('reIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.reIndex(function(error, result) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(result, true, 'should have created another index')

              verifyNoStats(t, agent, 'reIndex')
            })
          })
        })
      })
    })

    t.test('dropIndex', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('dropIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'dropIndex')

            collection.dropIndex('id_1', function(error, result) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              // nIndexesWas is nested mongodb v1.0
              var nIndexesWas = result.nIndexesWas || result.documents[0].nIndexesWas
              t.equal(nIndexesWas, 2, 'should have dropped an index')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'dropIndex')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('dropIndex requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.dropIndex('id_1', function(error, result) {
              t.notOk(agent.getTransaction(), 'should have no transaction')
              // mongodb v1.0 doesn't return error object
              var msg = error ? error.message : result.documents[0].errmsg
              t.ok(
                msg.indexOf('index not found') === 0,
                'shouldn\'t have found index to drop'
              )

              verifyNoStats(t, agent, 'dropIndex')
            })
          })
        })
      })
    })

    t.test('dropAllIndexes', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.autoend()
        t.comment('dropAllIndexes requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

          runWithTransaction(t, function(agent, collection, transaction) {
            addMetricsVerifier(t, agent, 'dropAllIndexes')

            collection.dropAllIndexes(function(error, result) {
              if (error) t.fail(error)

              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.equal(result, true, 'should have dropped the indexes')

              transaction.end()
              verifyTrace(t, agent.tracer.getSegment(), 'dropAllIndexes')
            })
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()
        t.comment('dropAllIndexes requires a callback')

        t.test('with callback', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.dropAllIndexes(function(error, result) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(result, true, 'should have dropped all those no indexes')

              verifyNoStats(t, agent, 'dropAllIndexes')
            })
          })
        })
      })
    })

    t.test('remove', function(t) {
      t.autoend()

      t.test('inside transaction', function(t) {
        t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)

        runWithTransaction(t, function(agent, collection, transaction) {
          addMetricsVerifier(t, agent, 'remove')

          collection.remove({id: 1}, {w: 1}, function(error, removed) {
            if (error) t.fail(error)

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.equal(removed, 1, 'should have removed 1 document from collection')

            transaction.end()
            verifyTrace(t, agent.tracer.getSegment(), 'remove')
          })
        })
      })

      t.test('outside transaction', function(t) {
        t.autoend()

        t.test('with callback', {timeout: 5000}, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.remove({id: 3}, {w: 1}, function(error, removed) {
              if (error) t.fail(error)

              t.notOk(agent.getTransaction(), 'should have no transaction')
              t.equal(removed, 1, 'should have removed 1 document from collection')

              verifyNoStats(t, agent, 'remove')
            })
          })
        })

        t.test('with no callback (w = 0)', OPTS, function(t) {
          t.plan(7)

          runWithoutTransaction(t, function(agent, collection) {
            collection.remove({id: 4})
            setTimeout(function() {
              collection.count({id: 4}, function(error, nope) {
                if (error) t.fail(error)

                t.notOk(agent.getTransaction(), 'should have no transaction')
                t.notOk(nope, 'should have removed document with id 4 from collection')

                verifyNoStats(t, agent, 'remove')
              })
            })
          })
        })
      })
    })

    t.test('aggregate', function(t) {
      t.autoend()

      var mongoVersion = require('mongodb/package.json').version
      var skip = semver.satisfies(mongoVersion, '<2')

      t.test('inside transaction', {skip: skip}, function(t) {
        t.plan(3 + TRACE_VERIFIER_COUNT)

        runWithTransaction(t, function(agent, collection, transaction) {
          collection.aggregate([{$match: {id: 1}}], function(error, data) {
            t.error(error)

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.deepEqual(data, [])

            transaction.end()
            verifyTrace(t, agent.tracer.getSegment(), 'aggregate')
          })
        })
      })

      t.test('outside transaction', {skip: skip}, function(t) {
        t.plan(8)

        runWithoutTransaction(t, function(agent, collection) {
          collection.aggregate([{$match: {id: 1}}], function(error, data) {
            t.error(error)

            t.notOk(agent.getTransaction(), 'should have no transaction')
            t.deepEqual(data, [])

            verifyNoStats(t, agent, 'aggregate')
          })
        })
      })
    })

    t.test('instance metrics with domain sockets', function(t) {
      var host = 'localhost'
      var path = getDomainSocketPath()

      // The domain socket tests should only be run if there is a domain socket
      // to connect to, which only happens if there is a Mongo instance running on
      // the same box as these tests. This should always be the case on Travis,
      // but just to be sure they're running there check for the environment flag.
      var shouldTestDomain = path || process.env.TRAVIS
      if (!shouldTestDomain) {
        t.comment('!!! Skipping domain socket test, none found.')
        return t.end()
      }

      var agent = helper.instrumentMockedAgent()
      var mongodb = require('mongodb')
      var server = new mongodb.Server(path)
      var db = new mongodb.Db(DB_NAME, server, {w: 1})

      t.tearDown(function() {
        db.close()
        helper.unloadAgent(agent)
      })

      t.plan(2 + TRACE_VERIFIER_COUNT + METRICS_VERIFIER_COUNT)
      db.open(function(err) {
        t.error(err)

        var collection = db.collection(COLLECTION)
        helper.runInTransaction(agent, function(tx) {
          addMetricsVerifier(t, agent, 'update', null, host, path)

          collection.update(
            { hamchunx: {$exists: true} },
            { $set: {__updatedWith: 'yup'} },
            { safe: true, multi: true },
            function(err) {
              t.error(err)
              tx.end(function() {
                verifyTrace(t, agent.tracer.getSegment(), 'update', host, path)
              })
            }
          )
        })
      })
    })
  })
})

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
