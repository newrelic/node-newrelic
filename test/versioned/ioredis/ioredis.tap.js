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
const DB_INDEX = 3

tap.test('ioredis instrumentation', (t) => {
  let agent = null
  let redisClient = null

  t.autoend()
  t.beforeEach(() => {
    return new Promise((resolve, reject) => {
      helper.flushRedisDb(DB_INDEX, (error) => {
        if (error) {
          return reject(error)
        }

        agent = helper.instrumentMockedAgent()

        let Redis = null
        try {
          Redis = require('ioredis')
        } catch (err) {
          return reject(err)
        }

        redisClient = new Redis(params.redis_port, params.redis_host)

        redisClient.once('ready', () => {
          redisClient.select(DB_INDEX, (err) => {
            if (err) {
              return reject(err)
            }

            resolve()
          })
        })
      })
    })
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    redisClient && redisClient.disconnect()
  })

  t.test('creates expected metrics', { timeout: 5000 }, (t) => {
    t.plan(1)

    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]

      t.doesNotThrow(() => {
        assertMetrics(tx.metrics, expected, false, false)
      }, 'should have expected metrics')
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
      t.equals(root.children.length, 2, 'root has two children')

      const setSegment = root.children[0]
      t.equals(setSegment.name, 'Datastore/operation/Redis/set')

      // ioredis operations return promise, any 'then' callbacks will be sibling segments
      // of the original redis call
      const getSegment = root.children[1]
      t.equals(getSegment.name, 'Datastore/operation/Redis/get')
      t.equals(getSegment.children.length, 0, 'should not contain any segments')

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
