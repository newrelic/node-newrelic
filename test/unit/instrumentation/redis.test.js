/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
const { redisClientOpts } = require('../../../lib/symbols')

tap.test('getRedisParams should behave as expected', function (t) {
  const { getRedisParams } = require('../../../lib/instrumentation/@node-redis/client')
  t.test('given no opts, should return sensible defaults', function (t) {
    const params = getRedisParams()
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 0
    }
    t.match(params, expected, 'redis client should be definable without params')
    t.end()
  })
  t.test('if host/port are defined incorrectly, should return expected defaults', function (t) {
    const params = getRedisParams({ host: 'myLocalHost', port: '1234' })
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 0
    }
    t.match(params, expected, 'should return sensible defaults if defined without socket')
    t.end()
  })
  t.test('if host/port are defined correctly, we should see them in config', function (t) {
    const params = getRedisParams({ socket: { host: 'myLocalHost', port: '1234' } })
    const expected = {
      host: 'myLocalHost',
      port_path_or_id: '1234',
      database_name: 0
    }
    t.match(params, expected, 'host/port should be returned when defined correctly')
    t.end()
  })
  t.test('path should be used if defined', function (t) {
    const params = getRedisParams({ socket: { path: '5678' } })
    const expected = {
      host: 'localhost',
      port_path_or_id: '5678',
      database_name: 0
    }
    t.match(params, expected, 'path should show up in params')
    t.end()
  })
  t.test('path should be preferred over port', function (t) {
    const params = getRedisParams({
      socket: { host: 'myLocalHost', port: '1234', path: '5678' }
    })
    const expected = {
      host: 'myLocalHost',
      port_path_or_id: '5678',
      database_name: 0
    }
    t.match(params, expected, 'path should show up in params')
    t.end()
  })
  t.test('database name should be definable', function (t) {
    const params = getRedisParams({ database: 12 })
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 12
    }
    t.match(params, expected, 'database should be definable')
    t.end()
  })

  t.test('host/port/database should be extracted from url when it exists', function (t) {
    const params = getRedisParams({ url: 'redis://host:6369/db' })
    const expected = {
      host: 'host',
      port_path_or_id: '6369',
      database_name: 'db'
    }
    t.match(params, expected, 'host/port/database should match')
    t.end()
  })

  t.test('should default port to 6379 when no port specified in URL', function (t) {
    const params = getRedisParams({ url: 'redis://host/db' })
    const expected = {
      host: 'host',
      port_path_or_id: '6379',
      database_name: 'db'
    }
    t.match(params, expected, 'host/port/database should match')
    t.end()
  })

  t.test('should default database to 0 when no db pecified in URL', function (t) {
    const params = getRedisParams({ url: 'redis://host' })
    const expected = {
      host: 'host',
      port_path_or_id: '6379',
      database_name: 0
    }
    t.match(params, expected, 'host/port/database should match')
    t.end()
  })
  t.end()
})

tap.test('createClient saves connection options', function (t) {
  t.beforeEach((t) => {
    t.context.sandbox = sinon.createSandbox()
    t.context.agent = helper.loadMockedAgent()
    t.context.shim = new DatastoreShim(t.context.agent, 'redis')
    t.context.instrumentation = require('../../../lib/instrumentation/@node-redis/client')
    t.context.clients = {
      1: { socket: { host: '1', port: 2 } },
      2: { socket: { host: '2', port: 3 } }
    }
    let i = 0
    class CommandQueueClass {
      constructor() {
        i++
        this.id = i
        const expectedValues = t.context.clients[this.id]
        t.match(t.context.shim[redisClientOpts], {
          host: expectedValues.socket.host,
          port_path_or_id: expectedValues.socket.port
        })
      }

      async addCommand() {}
    }

    const commandQueueStub = { default: CommandQueueClass }
    const redis = Object.create({
      createClient: function () {
        const instance = Object.create({})
        // eslint-disable-next-line new-cap
        instance.queue = new commandQueueStub.default()
        return instance
      }
    })

    t.context.sandbox.stub(t.context.shim, 'require').returns(commandQueueStub)
    t.context.redis = redis
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
    t.context.sandbox.restore()
  })

  t.test('should remove connect options after creation', function (t) {
    const { agent, redis, shim, instrumentation, clients } = t.context
    instrumentation(agent, redis, 'redis', shim)
    redis.createClient(clients[1])
    t.notOk(shim[redisClientOpts], 'should remove client options after creation')
    redis.createClient(clients[2])
    t.notOk(shim[redisClientOpts], 'should remove client options after creation')
    t.end()
  })

  t.test('should keep the connection details per client', function (t) {
    const { agent, redis, shim, instrumentation, clients } = t.context
    instrumentation(agent, redis, 'redis', shim)
    const client = redis.createClient(clients[1])
    const client2 = redis.createClient(clients[2])
    helper.runInTransaction(agent, async function (tx) {
      await client.queue.addCommand(['test', 'key', 'value'])
      await client2.queue.addCommand(['test2', 'key2', 'value2'])
      const [redisSegment, redisSegment2] = tx.trace.root.children
      const attrs = redisSegment.getAttributes()
      t.same(
        attrs,
        {
          host: '1',
          port_path_or_id: 2,
          key: '"key"',
          value: '"value"',
          product: 'Redis',
          database_name: '0'
        },
        'should have appropriate segment attrs'
      )
      const attrs2 = redisSegment2.getAttributes()
      t.same(
        attrs2,
        {
          host: '2',
          port_path_or_id: 3,
          key: '"key2"',
          value: '"value2"',
          product: 'Redis',
          database_name: '0'
        },
        'should have appropriate segment attrs'
      )
      t.end()
    })
  })
  t.end()
})
