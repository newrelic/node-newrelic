/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

process.env.NEW_RELIC_HOME = __dirname

var tap = require('tap')
var logger = require('../../../lib/logger')
var helper = require('../../lib/agent_helper')
var urltils = require('../../../lib/util/urltils')
var params = require('../../lib/params')
var setup = require('./setup')


tap.test('Basic run through mysql functionality', {timeout: 30 * 1000}, function(t) {
  t.autoend()

  var agent = null
  var mysql = null
  var poolLogger = logger.child({component: 'pool'})
  var pool = null

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    mysql = require('mysql2')
    pool = setup.pool(mysql, poolLogger)

    setup(mysql, done)
  })

  t.afterEach(function(done) {
    pool.drain(function() {
      pool.destroyAllNow()
      helper.unloadAgent(agent)
      done()
    })
  })

  var withRetry = {
    getClient : function(callback, counter) {
      if (!counter) counter = 1
      counter++

      pool.acquire(function(err, client) {
        if (err) {
          poolLogger.error('Failed to get connection from the pool: %s', err)

          if (counter < 10) {
            pool.destroy(client)
            withRetry.getClient(callback, counter)
          } else {
            return callback(new Error('Couldn\'t connect to DB after 10 attempts.'))
          }
        } else {
          callback(null, client)
        }
      })
    },

    release : function(client) {
      pool.release(client)
    }
  }

  t.test('basic transaction', function testTransaction(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        client.query('SELECT 1', function(err) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)

          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('query with values', function testCallbackOnly(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        client.query('SELECT 1', [], function(err) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)
          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('query with options streaming should work', function testCallbackOnly(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        var query = client.query('SELECT 1', [])
        var results = false

        query.on('result', function() {
          results = true
        })

        query.on('error', function(err) {
          if (err) return t.fail(err)
        })

        query.on('end', function() {
          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)
          t.ok(results, 'results should be received')
          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('ensure database name changes with a use statement', function(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')
      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)
        client.query('create database if not exists test_db;', function(err) {
          t.error(err, 'should not fail to create database')

          client.query('use test_db;', function(err) {
            t.error(err, 'should not fail to set database')

            client.query('SELECT 1 + 1 AS solution', function(err) {
              var seg = agent.tracer.getSegment().parent
              const attributes = seg.getAttributes()

              t.notOk(err, 'no errors')
              t.ok(seg, 'there is a segment')
              t.equal(
                attributes.host,
                urltils.isLocalhost(params.mysql_host)
                  ? agent.config.getHostnameSafe()
                  : params.mysql_host,
                'set host'
              )
              t.equal(
                attributes.database_name,
                'test_db',
                'set database name'
              )
              t.equal(
                attributes.port_path_or_id,
                '3306',
                'set port'
              )
              t.equal(attributes.product, 'MySQL', 'should set product attribute')
              withRetry.release(client)
              agent.getTransaction().end()
              t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
              for (let sample of agent.queries.samples.values()) {
                t.ok(sample.total > 0, 'the samples should have positive duration')
              }
              t.end()
            })
          })
        })
      })
    })
  })

  t.test('query via execute() should be instrumented', function testTransaction(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        client.execute('SELECT 1', function(err) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)

          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('streaming query should be timed correctly', function testCB(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        var query = client.query('SELECT SLEEP(1)', [])
        var start = Date.now()
        var duration = null
        var results = false
        var ended = false

        query.on('result', function() {
          results = true
        })

        query.on('error', function(err) {
          if (err) return t.fail(err, 'streaming should not fail')
        })

        query.on('end', function() {
          duration = Date.now() - start
          ended = true
        })

        setTimeout(function actualEnd() {
          const transaction = agent.getTransaction().end()
          withRetry.release(client)
          t.ok(results && ended, 'result and end events should occur')
          var traceRoot = transaction.trace.root
          var traceRootDuration = traceRoot.timer.getDurationInMillis()
          var segment = findSegment(
            traceRoot,
            'Datastore/statement/MySQL/unknown/select'
          )
          var queryNodeDuration = segment.timer.getDurationInMillis()

          t.ok(
            Math.abs(duration - queryNodeDuration) < 50,
            'query duration should be roughly be the time between query and end'
          )

          t.ok(
            traceRootDuration - queryNodeDuration > 900,
            'query duration should be small compared to transaction duration'
          )

          t.end()
        }, 2000)
      })
    })
  })

  t.test('streaming query children should nest correctly', function testCB(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        var query = client.query('SELECT 1', [])

        query.on('result', function resultCallback() {
          setTimeout(function resultTimeout() {
          }, 10)
        })

        query.on('error', function errorCallback(err) {
          if (err) return t.fail(err, 'streaming should not fail')
        })

        query.on('end', function endCallback() {
          setTimeout(function actualEnd() {
            const transaction = agent.getTransaction().end()
            withRetry.release(client)
            var traceRoot = transaction.trace.root
            var querySegment = traceRoot.children[0]
            t.equal(
              querySegment.children.length, 2,
              'the query segment should have two children'
            )

            var childSegment = querySegment.children[1]
            t.equal(
              childSegment.name, 'Callback: endCallback',
              'children should be callbacks'
            )
            var grandChildSegment = childSegment.children[0]
            t.equal(
              grandChildSegment.name, 'timers.setTimeout',
              'grand children should be timers'
            )
            t.end()
          }, 100)
        })
      })
    })
  })

  t.test('query with options object rather than sql', function testCallbackOnly(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        client.query({sql: 'SELECT 1'}, function(err) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)
          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('query with options object and values', function testCallbackOnly(t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'we should be in a transaction')

      withRetry.getClient(function(err, client) {
        if (err) return t.fail(err)

        t.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
        client.query({sql: 'SELECT 1'}, [], function(err) {
          if (err) return t.fail(err)

          t.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          withRetry.release(client)
          agent.getTransaction().end()
          t.ok(agent.queries.samples.size > 0, 'there should be a query sample')
          for (let sample of agent.queries.samples.values()) {
            t.ok(sample.total > 0, 'the samples should have positive duration')
          }
          t.end()
        })
      })
    })
  })

  t.test('ensure database name changes with a use statement', function(t) {
    helper.runInTransaction(agent, function transactionInScope(txn) {
      withRetry.getClient(function(err, client) {
        client.query('create database if not exists test_db;', function(err) {
          t.error(err)
          client.query('use test_db;', function(err) {
            t.error(err)
            client.query('SELECT 1 + 1 AS solution', function(err) {
              var seg = agent.tracer.getSegment().parent
              const attributes = seg.getAttributes()
              t.error(err)
              if (t.ok(seg, 'should have a segment')) {
                t.equal(
                  attributes.host,
                  urltils.isLocalhost(params.mysql_host)
                    ? agent.config.getHostnameSafe()
                    : params.mysql_host,
                  'should set host parameter'
                )
                t.equal(
                  attributes.database_name,
                  'test_db',
                  'should use new database name'
                )
                t.equal(
                  attributes.port_path_or_id,
                  "3306",
                  'should set port parameter'
                )
                t.equal(attributes.product, 'MySQL', 'should set product attribute')
              }
              client.query('drop test_db;', function() {
                withRetry.release(client)
                txn.end()
                t.end()
              })
            })
          })
        })
      })
    })
  })
})

function findSegment(root, segmentName) {
  for (var i = 0; i < root.children.length; i++) {
    var segment = root.children[i]
    if (segment.name === segmentName) {
      return segment
    }
  }
}
