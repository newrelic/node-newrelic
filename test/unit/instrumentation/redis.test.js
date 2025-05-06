/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
const { removeMatchedModules } = require('#testlib/cache-buster.js')
const { redisClientOpts } = require('../../../lib/symbols')
const { getRedisParams } = require('../../../lib/instrumentation/@node-redis/client')

test('logs warnings correctly', async t => {
  const instrumentation = require('../../../lib/instrumentation/redis.js')

  t.beforeEach(ctx => {
    ctx.nr = {
      logs: [],
      shim: {
        pkgVersion: '5.0.0',
        logger: {
          warn(msg) { ctx.nr.logs.push(msg) }
        }
      }
    }
  })

  t.after(() => {
    removeMatchedModules(/redis/)
  })

  await t.test('missing required prototype', t => {
    const { shim } = t.nr
    instrumentation(null, null, null, shim)
    assert.equal(t.nr.logs.length, 1)
    assert.equal(t.nr.logs[0], 'Skipping redis instrumentation due to unrecognized module shape')
  })
})

test('getRedisParams should behave as expected', async function (t) {
  await t.test('given no opts, should return sensible defaults', async function () {
    const params = getRedisParams()
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 0,
      collection: null
    }
    assert.deepEqual(params, expected, 'redis client should be definable without params')
  })
  await t.test(
    'if host/port are defined incorrectly, should return expected defaults',
    async function () {
      const params = getRedisParams({ host: 'myLocalHost', port: '1234' })
      const expected = {
        host: 'myLocalHost',
        port_path_or_id: '1234',
        database_name: 0,
        collection: null
      }
      assert.deepEqual(
        params,
        expected,
        'should return sensible defaults if defined without socket'
      )
    }
  )
  await t.test(
    'if host/port are defined correctly, we should see them in config',
    async function () {
      const params = getRedisParams({ socket: { host: 'myLocalHost', port: '1234' } })
      const expected = {
        host: 'myLocalHost',
        port_path_or_id: '1234',
        database_name: 0,
        collection: null
      }
      assert.deepEqual(params, expected, 'host/port should be returned when defined correctly')
    }
  )
  await t.test('path should be used if defined', async function () {
    const params = getRedisParams({ socket: { path: '5678' } })
    const expected = {
      host: 'localhost',
      port_path_or_id: '5678',
      database_name: 0,
      collection: null
    }
    assert.deepEqual(params, expected, 'path should show up in params')
  })
  await t.test('path should be preferred over port', async function () {
    const params = getRedisParams({
      socket: { host: 'myLocalHost', port: '1234', path: '5678' }
    })
    const expected = {
      host: 'myLocalHost',
      port_path_or_id: '5678',
      database_name: 0,
      collection: null
    }
    assert.deepEqual(params, expected, 'path should show up in params')
  })
  await t.test('database name should be definable', async function () {
    const params = getRedisParams({ database: 12 })
    const expected = {
      host: 'localhost',
      port_path_or_id: '6379',
      database_name: 12,
      collection: null
    }
    assert.deepEqual(params, expected, 'database should be definable')
  })

  await t.test('host/port/database should be extracted from url when it exists', async function () {
    const params = getRedisParams({ url: 'redis://host:6369/db' })
    const expected = {
      host: 'host',
      port_path_or_id: '6369',
      database_name: 'db',
      collection: null
    }
    assert.deepEqual(params, expected, 'host/port/database should match')
  })

  await t.test('should default port to 6379 when no port specified in URL', async function () {
    const params = getRedisParams({ url: 'redis://host/db' })
    const expected = {
      host: 'host',
      port_path_or_id: '6379',
      database_name: 'db',
      collection: null
    }
    assert.deepEqual(params, expected, 'host/port/database should match')
  })

  await t.test('should default database to 0 when no db specified in URL', async function () {
    const params = getRedisParams({ url: 'redis://host' })
    const expected = {
      host: 'host',
      port_path_or_id: '6379',
      database_name: 0,
      collection: null
    }
    assert.deepEqual(params, expected, 'host/port/database should match')
  })
})

test('createClient saves connection options', async function (t) {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.sandbox = sinon.createSandbox()
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.shim = new DatastoreShim(ctx.nr.agent, 'redis')
    ctx.nr.instrumentation = require('../../../lib/instrumentation/@node-redis/client')
    ctx.nr.clients = {
      1: { socket: { host: '1', port: 2 } },
      2: { socket: { host: '2', port: 3 } }
    }
    let i = 0
    class CommandQueueClass {
      constructor() {
        i++
        this.id = i
        const expectedValues = ctx.nr.clients[this.id]
        assert.deepEqual(ctx.nr.shim[redisClientOpts], {
          host: expectedValues.socket.host,
          port_path_or_id: expectedValues.socket.port,
          collection: null,
          database_name: 0
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

    ctx.nr.sandbox.stub(ctx.nr.shim, 'require').returns(commandQueueStub)
    ctx.nr.redis = redis
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.sandbox.restore()
  })

  await t.test('should remove connect options after creation', async function (t) {
    const { agent, redis, shim, instrumentation, clients } = t.nr
    instrumentation(agent, redis, 'redis', shim)
    redis.createClient(clients[1])
    assert.ok(!shim[redisClientOpts], 'should remove client options after creation')
    redis.createClient(clients[2])
    assert.ok(!shim[redisClientOpts], 'should remove client options after creation')
  })

  await t.test('should keep the connection details per client', function (t, end) {
    const { agent, redis, shim, instrumentation, clients } = t.nr
    instrumentation(agent, redis, 'redis', shim)
    const client = redis.createClient(clients[1])
    const client2 = redis.createClient(clients[2])
    helper.runInTransaction(agent, async function (tx) {
      await client.queue.addCommand(['test', 'key', 'value'])
      await client2.queue.addCommand(['test2', 'key2', 'value2'])
      const [redisSegment, redisSegment2] = tx.trace.getChildren(tx.trace.root.id)
      const attrs = redisSegment.getAttributes()
      assert.deepEqual(
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
      assert.deepEqual(
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
      end()
    })
  })
})
