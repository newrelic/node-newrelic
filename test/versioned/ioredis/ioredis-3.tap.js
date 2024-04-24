/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
require('../../lib/metrics_helper')
const params = require('../../lib/params')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 4

tap.test('ioredis instrumentation', function (t) {
  let agent
  let redisClient

  t.beforeEach(async function () {
    const result = await setup(t)
    agent = result.agent
    redisClient = result.client
  })

  t.afterEach(function () {
    agent && helper.unloadAgent(agent)
    redisClient && redisClient.disconnect()
  })

  t.test('creates expected metrics', { timeout: 5000 }, function (t) {
    const onError = function (error) {
      return t.fail(error)
    }

    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]
      t.assertMetrics(tx.metrics, expected, false, false)
      t.end()
    })

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      redisClient
        .set('testkey', 'testvalue')
        .then(function () {
          transaction.end()
        }, onError)
        .catch(onError)
    })
  })

  t.test('creates expected segments', { timeout: 5000 }, function (t) {
    const onError = function (error) {
      return t.fail(error)
    }

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      t.equal(root.children.length, 2, 'root has two children')

      const setSegment = root.children[0]
      t.equal(setSegment.name, 'Datastore/operation/Redis/set')

      // ioredis operations return promise, any 'then' callbacks will be sibling segments
      // of the original redis call
      const getSegment = root.children[1]
      t.equal(getSegment.name, 'Datastore/operation/Redis/get')
      t.equal(getSegment.children.length, 0, 'should not contain any segments')

      t.end()
    })

    helper.runInTransaction(agent, function transactionInScope(transaction) {
      redisClient
        .set('testkey', 'testvalue')
        .then(function () {
          return redisClient.get('testkey')
        })
        .then(function () {
          transaction.end()
        })
        .catch(onError)
    })
  })

  // NODE-1524 regression
  t.test('does not crash when ending out of transaction', function (t) {
    helper.runInTransaction(agent, function transactionInScope(transaction) {
      t.ok(agent.getTransaction(), 'transaction should be in progress')
      redisClient.set('testkey', 'testvalue').then(function () {
        t.notOk(agent.getTransaction(), 'transaction should have ended')
        t.end()
      })
      transaction.end()
    })
  })

  t.autoend()
})

async function setup(t) {
  const agent = helper.instrumentMockedAgent()

  // remove from cache, so that the bluebird library that ioredis uses gets
  // re-instrumented
  clearLoadedModules(t)

  const Redis = require('ioredis')

  const client = new Redis(params.redis_port, params.redis_host)
  await helper.flushRedisDb(client, DB_INDEX)

  return new Promise(async (resolve, reject) => {
    client.select(DB_INDEX, (err) => {
      if (err) {
        return reject(err)
      }

      resolve({ agent, client })
    })
  })
}

function clearLoadedModules(t) {
  const deletedCount = removeMatchedModules(/ioredis\/node_modules\/ioredis/)
  t.comment(`Cleared ${deletedCount} modules matching '*/ioredis/node_modules/ioredis/*'`)
}
