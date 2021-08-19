/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const FakeConnection = require('./redis-connection')

tap.test('agent instrumentation of Redis', function (t) {
  t.autoend()

  t.test("shouldn't cause bootstrapping to fail", function (t) {
    t.autoend()

    let agent
    let initialize

    t.before(function () {
      agent = helper.loadMockedAgent()
      initialize = require('../../../lib/instrumentation/redis')
    })

    t.teardown(function () {
      helper.unloadAgent(agent)
    })

    t.test('when passed no module', function (t) {
      t.doesNotThrow(function () {
        initialize(agent)
      })
      t.end()
    })

    t.test('when passed a module with no RedisClient present.', function (t) {
      t.doesNotThrow(function () {
        initialize(agent, {})
      })
      t.end()
    })
  })

  // Redis has a lot of commands, and this is not all of them.
  t.test('when run', function (t) {
    t.autoend()
    let agent
    let client
    let connection
    let mockConnection

    t.beforeEach(function () {
      agent = helper.instrumentMockedAgent()
      const redis = require('redis')

      connection = new FakeConnection()
      mockConnection = sinon.mock(connection)

      client = new redis.RedisClient(connection, { no_ready_check: true })
      client.host = 'fakehost.example.local'
      client.port = 8765
    })

    t.afterEach(function () {
      mockConnection.verify()
      helper.unloadAgent(agent)
    })

    t.test('should instrument PING', function (t) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once()

      agent.once('transactionFinished', function (transaction) {
        const stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        t.equal(stats.callCount, 1)

        t.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        t.ok(transaction)

        /* eslint-disable new-cap */
        client.PING(function pingCb(error, results) {
          t.error(error)
          t.ok(agent.getTransaction())
          t.equal(results, 'PONG', 'PING should still work')
        })
        /* eslint-enable new-cap */

        t.ok(connection.on_data)
        connection.on_data(Buffer.from('+PONG\r\n'))

        transaction.end()
      })
    })

    t.test('should instrument PING without callback', function (t) {
      mockConnection.expects('write').withExactArgs('*1\r\n$4\r\nping\r\n').once()

      agent.once('transactionFinished', function (transaction) {
        const stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        t.equal(stats.callCount, 1)

        t.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        t.ok(transaction)

        /* eslint-disable new-cap */
        client.PING(function pingCb() {
          transaction.end()
        })
        /* eslint-enable new-cap */

        t.ok(connection.on_data)
        connection.on_data(Buffer.from('+PONG\r\n'))
      })
    })

    t.test('should instrument PING with callback in array', function (t) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once()

      agent.once('transactionFinished', function (transaction) {
        const stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        t.equal(stats.callCount, 1)
        t.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        t.ok(transaction)

        /* eslint-disable new-cap */
        client.PING(1, 2, function (error, results) {
          t.error(error)
          t.ok(agent.getTransaction())
          t.equal(results, 'PONG', 'PING should still work')
        })
        /* eslint-enable new-cap */

        t.ok(connection.on_data)
        connection.on_data(Buffer.from('+PONG\r\n'))

        transaction.end()
      })
    })

    t.test('should instrument PING with no callback in array', function (t) {
      mockConnection
        .expects('write')
        .withExactArgs('*3\r\n$4\r\nping\r\n$1\r\n1\r\n$1\r\n2\r\n')
        .once()

      agent.once('transactionFinished', function (transaction) {
        const stats = transaction.metrics.getMetric('Datastore/operation/Redis/ping')
        t.equal(stats.callCount, 1)

        t.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        t.ok(transaction)

        /* eslint-disable new-cap */
        client.PING(1, 2, function () {
          transaction.end()
        })
        /* eslint-enable new-cap */

        t.ok(connection.on_data)
        connection.on_data(Buffer.from('+PONG\r\n'))
      })
    })
  })
})
