/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const assertMetrics = require('../../lib/metrics_helper').assertMetrics
const params = require('../../lib/params')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 4

tap.test('ioredis instrumentation', function(t) {
  var agent, redisClient

  t.beforeEach(function(done) {
    setup(t, function(error, result) {
      if (error) {
        return done(error)
      }

      agent = result.agent
      redisClient = result.client
      done()
    })
  })

  t.afterEach(function(done) {
    agent && helper.unloadAgent(agent)
    redisClient && redisClient.disconnect()
    done()
  })

  t.test('creates expected metrics', {timeout : 5000}, function(t) {
    var onError = function(error) { return t.fail(error) }

    agent.on('transactionFinished', function(tx) {
      var expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]
      assertMetrics(tx.metrics, expected, false, false)
      t.end()
    })

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      redisClient.set('testkey', 'testvalue').then(function() {
        transaction.end()
      }, onError).catch(onError)
    })
  })

  t.test('creates expected segments', {timeout : 5000}, function(t) {
    var onError = function(error) { return t.fail(error) }

    agent.on('transactionFinished', function(tx) {
      var root = tx.trace.root
      t.equals(root.children.length, 2, 'root has two children')

      var setSegment = root.children[0]
      t.equals(setSegment.name, 'Datastore/operation/Redis/set')

      // ioredis operations return promise, any 'then' callbacks will be sibling segments
      // of the original redis call
      var getSegment = root.children[1]
      t.equals(getSegment.name, 'Datastore/operation/Redis/get')
      t.equals(getSegment.children.length, 0, 'should not contain any segments')

      t.end()
    })

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      redisClient.set('testkey', 'testvalue')
        .then(function() {
          return redisClient.get('testkey')
        })
        .then(function() {
          transaction.end()
        })
        .catch(onError)
    })
  })

  // NODE-1524 regression
  t.test('does not crash when ending out of transaction', function(t) {
    helper.runInTransaction(agent, function transactionInScope(transaction) {
      t.ok(agent.getTransaction(), 'transaction should be in progress')
      redisClient.set('testkey', 'testvalue')
        .then(function() {
          t.notOk(agent.getTransaction(), 'transaction should have ended')
          t.end()
        })
      transaction.end()
    })
  })

  t.autoend()
})


function setup(t, callback) {
  helper.flushRedisDb(DB_INDEX, (error) => {
    if (error) {
      return callback(error)
    }

    var agent = helper.instrumentMockedAgent()

    // remove from cache, so that the bluebird library that ioredis uses gets
    // re-instrumented
    var name = require.resolve('ioredis')
    delete require.cache[name]

    var Redis = require('ioredis')
    var client = new Redis(params.redis_port, params.redis_host)

    callback(null, {agent, client})
  })
}
