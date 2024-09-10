/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
require('../../lib/metrics_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 3

tap.test('ioredis instrumentation', (t) => {
  let agent = null
  let redisClient = null
  let METRIC_HOST_NAME
  let HOST_ID

  t.autoend()
  t.beforeEach(async () => {
    agent = helper.instrumentMockedAgent()
    const Redis = require('ioredis')
    redisClient = new Redis(params.redis_port, params.redis_host)
    await helper.flushRedisDb(redisClient, DB_INDEX)
    METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

    await new Promise(async (resolve, reject) => {
      redisClient.select(DB_INDEX, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    redisClient && redisClient.disconnect()
  })

  t.test('creates expected metrics', { timeout: 5000 }, (t) => {
    t.plan(6)
    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]
      expected['Datastore/instance/Redis/' + HOST_ID] = 2

      t.assertMetrics(tx.metrics, expected, false, false)
      t.end()
    })

    helper.runInTransaction(agent, (transaction) => {
      redisClient
        .set('testkey', 'testvalue')
        .then(function () {
          transaction.end()
        }, t.error)
        .catch(t.error)
    })
  })

  t.test('creates expected segments', { timeout: 5000 }, (t) => {
    t.plan(5)

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

    helper.runInTransaction(agent, (transaction) => {
      redisClient
        .set('testkey', 'testvalue')
        .then(() => redisClient.get('testkey'))
        .then((value) => {
          t.equal(value, 'testvalue', 'should have expected value')
          transaction.end()
        })
        .catch(t.error)
    })
  })

  // NODE-1524 regression
  t.test('does not crash when ending out of transaction', (t) => {
    helper.runInTransaction(agent, (transaction) => {
      t.ok(agent.getTransaction(), 'transaction should be in progress')
      redisClient.set('testkey', 'testvalue').then(function () {
        t.notOk(agent.getTransaction(), 'transaction should have ended')
        t.end()
      })
      transaction.end()
    })
  })
})
