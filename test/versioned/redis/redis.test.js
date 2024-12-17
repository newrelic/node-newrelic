/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { tspl } = require('@matteo.collina/tspl')
const { checkMetrics } = require('./utils')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 2

test('Redis instrumentation', { timeout: 20000 }, async function (t) {
  t.beforeEach(async function (ctx) {
    const agent = helper.instrumentMockedAgent()
    const redis = require('redis')
    const client = redis.createClient(params.redis_port, params.redis_host)
    await helper.flushRedisDb(client, DB_INDEX)
    await new Promise((resolve, reject) => {
      client.select(DB_INDEX, function (err) {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })

    const METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    const HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    // Start testing!
    assert.ok(!agent.getTransaction(), 'no transaction should be in play')
    ctx.nr = {
      agent,
      client,
      HOST_ID,
      METRIC_HOST_NAME
    }
  })

  t.afterEach(function (ctx) {
    const { agent, client } = ctx.nr
    client.end({ flush: false })
    helper.unloadAgent(agent)
  })

  await t.test('should find Redis calls in the transaction trace', async function (t) {
    const { agent, client } = t.nr
    const plan = tspl(t, { plan: 19 })
    helper.runInTransaction(agent, function transactionInScope() {
      const transaction = agent.getTransaction()
      plan.ok(transaction, 'transaction should be visible')

      client.set('testkey', 'arglbargle', function (error, ok) {
        plan.ok(!error)
        plan.ok(agent.getTransaction(), 'transaction should still be visible')
        plan.ok(ok, 'everything should be peachy after setting')

        client.get('testkey', function (error, value) {
          plan.ok(!error)
          plan.ok(agent.getTransaction(), 'transaction should still still be visible')
          plan.equal(value, 'arglbargle', 'redis client should still work')

          const trace = transaction.trace
          plan.ok(trace, 'trace should exist')
          plan.ok(trace.root, 'root element should exist')
          plan.equal(trace.root.children.length, 1, 'there should be only one child of the root')

          const setSegment = trace.root.children[0]
          const setAttributes = setSegment.getAttributes()
          plan.ok(setSegment, 'trace segment for set should exist')
          plan.equal(setSegment.name, 'Datastore/operation/Redis/set', 'should register the set')
          plan.equal(setAttributes.key, '"testkey"', 'should have the set key as a attribute')
          plan.equal(setSegment.children.length, 1, 'set should have an only child')

          const getSegment = setSegment.children[0].children[0]
          const getAttributes = getSegment.getAttributes()
          plan.ok(getSegment, 'trace segment for get should exist')

          plan.equal(getSegment.name, 'Datastore/operation/Redis/get', 'should register the get')

          plan.equal(getAttributes.key, '"testkey"', 'should have the get key as a attribute')

          plan.ok(getSegment.children.length >= 1, 'get should have a callback segment')

          plan.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
        })
      })
    })
    await plan.completed
  })

  await t.test('when called without a callback', async function (t) {
    const { agent, client } = t.nr
    const plan = tspl(t, { plan: 4 })

    let transaction = null

    helper.runInTransaction(agent, function (tx) {
      transaction = tx

      client.set('testKey', 'testvalue')

      triggerError()

      function triggerError() {
        // When the redis service responds, the command is dequeued and then
        // the command callback is executed, if exists. Since we don't have a callback,
        // we wait for the command to be removed from the queue.
        if (client.commandQueueLength > 0) {
          setTimeout(triggerError, 100)
          return
        }

        // This will generate an error because `testKey` is not a hash.
        client.hset('testKey', 'hashKey', 'foobar')
      }
    })

    client.on('error', function (err) {
      plan.ok(err, 'should emit errors on the client')
      plan.equal(
        err.message,
        'WRONGTYPE Operation against a key holding the wrong kind of value',
        'errors should have the expected error message'
      )

      // Ensure error triggering operation has completed before
      // continuing test assertions.
      transaction.end()
    })

    agent.on('transactionFinished', function (tx) {
      const redSeg = tx.trace.root.children[0]
      plan.equal(
        redSeg.name,
        'Datastore/operation/Redis/set',
        'should have untruncated redis segment'
      )
      plan.equal(redSeg.children.length, 0, 'should have no children for redis segment')
    })
    await plan.completed
  })

  await t.test('should create correct metrics', async function (t) {
    const { agent, client, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 16 })
    helper.runInTransaction(agent, function transactionInScope() {
      const transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function (error) {
        plan.ok(!error)
        client.get('testkey', function (error) {
          plan.ok(!error)
          transaction.end()
          const metrics = transaction.metrics.unscoped
          const expected = {
            'Datastore/all': 2,
            'Datastore/allWeb': 2,
            'Datastore/Redis/all': 2,
            'Datastore/Redis/allWeb': 2,
            'Datastore/operation/Redis/set': 1,
            'Datastore/operation/Redis/get': 1
          }
          expected['Datastore/instance/Redis/' + HOST_ID] = 2
          checkMetrics({ check: plan, metrics, expected })
        })
      })
    })
    await plan.completed
  })

  await t.test('should handle multi commands', function (t, end) {
    const { agent, client, HOST_ID } = t.nr
    helper.runInTransaction(agent, function transactionInScope() {
      const transaction = agent.getTransaction()
      client
        .multi()
        .set('multi-key', 'multi-value')
        .get('multi-key')
        .exec(function (error, data) {
          assert.deepEqual(data, ['OK', 'multi-value'], 'should return expected results')
          assert.ok(!error)
          transaction.end()
          const metrics = transaction.metrics.unscoped
          const expected = {
            'Datastore/all': 4,
            'Datastore/allWeb': 4,
            'Datastore/Redis/all': 4,
            'Datastore/Redis/allWeb': 4,
            'Datastore/operation/Redis/multi': 1,
            'Datastore/operation/Redis/set': 1,
            'Datastore/operation/Redis/get': 1,
            'Datastore/operation/Redis/exec': 1
          }
          expected['Datastore/instance/Redis/' + HOST_ID] = 4
          checkMetrics({ metrics, expected })
          end()
        })
    })
  })

  await t.test('should add `key` attribute to trace segment', function (t, end) {
    const { agent, client } = t.nr
    agent.config.attributes.enabled = true

    helper.runInTransaction(agent, function () {
      client.set('saveme', 'foobar', function (error) {
        // Regardless of error, key should still be captured.
        assert.ok(!error)
        const segment = agent.tracer.getSegment().parent
        assert.equal(segment.getAttributes().key, '"saveme"', 'should have `key` attribute')
        end()
      })
    })
  })

  await t.test('should not add `key` attribute to trace segment', function (t, end) {
    const { agent, client } = t.nr
    agent.config.attributes.enabled = false

    helper.runInTransaction(agent, function () {
      client.set('saveme', 'foobar', function (error) {
        // Regardless of error, key should still be captured.
        assert.ok(!error)
        const segment = agent.tracer.getSegment().parent
        assert.ok(!segment.getAttributes().key, 'should not have `key` attribute')
        end()
      })
    })
  })

  await t.test('should add datastore instance attributes to trace segments', async function (t) {
    const { agent, client, METRIC_HOST_NAME } = t.nr
    const plan = tspl(t, { plan: 5 })
    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, function transactionInScope() {
      const transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function (error) {
        plan.ok(!error)
        const trace = transaction.trace
        const setSegment = trace.root.children[0]
        const attributes = setSegment.getAttributes()
        plan.equal(attributes.host, METRIC_HOST_NAME, 'should have host as attribute')
        plan.equal(
          attributes.port_path_or_id,
          String(params.redis_port),
          'should have port as attribute'
        )
        plan.equal(
          attributes.database_name,
          String(DB_INDEX),
          'should have database id as attribute'
        )
        plan.equal(attributes.product, 'Redis', 'should have product attribute')
      })
    })
    await plan.completed
  })

  await t.test('should not add instance attributes/metrics when disabled', async function (t) {
    const { agent, client, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 5 })
    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, function transactionInScope() {
      const transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function (error) {
        plan.ok(!error)
        const setSegment = transaction.trace.root.children[0]
        const attributes = setSegment.getAttributes()
        plan.equal(attributes.host, undefined, 'should not have host attribute')
        plan.equal(attributes.port_path_or_id, undefined, 'should not have port attribute')
        plan.equal(attributes.database_name, undefined, 'should not have db name attribute')

        transaction.end()
        const unscoped = transaction.metrics.unscoped
        plan.equal(
          unscoped['Datastore/instance/Redis/' + HOST_ID],
          undefined,
          'should not have instance metric'
        )
      })
    })
    await plan.completed
  })

  await t.test('should follow selected database', async function (t) {
    const { agent, client } = t.nr
    const plan = tspl(t, { plan: 12 })
    let transaction = null
    const SELECTED_DB = 3
    helper.runInTransaction(agent, function (tx) {
      transaction = tx
      client.set('select:test:key', 'foo', function (err) {
        plan.ok(!err, 'should not fail to set')
        plan.ok(agent.getTransaction(), 'should not lose transaction state')

        client.select(SELECTED_DB, function (err) {
          plan.ok(!err, 'should not fail to select')
          plan.ok(agent.getTransaction(), 'should not lose transaction state')

          client.set('select:test:key:2', 'bar', function (err) {
            plan.ok(!err, 'should not fail to set in db 2')
            plan.ok(agent.getTransaction(), 'should not lose transaction state')
            transaction.end()
            verify()
          })
        })
      })
    })
    await plan.completed

    function verify() {
      const setSegment1 = transaction.trace.root.children[0]
      const selectSegment = setSegment1.children[0].children[0]
      const setSegment2 = selectSegment.children[0].children[0]

      plan.equal(setSegment1.name, 'Datastore/operation/Redis/set', 'should register the first set')
      plan.equal(
        setSegment1.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the first set'
      )
      plan.equal(
        selectSegment.name,
        'Datastore/operation/Redis/select',
        'should register the select'
      )
      plan.equal(
        selectSegment.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the select'
      )
      plan.equal(
        setSegment2.name,
        'Datastore/operation/Redis/set',
        'should register the second set'
      )
      plan.equal(
        setSegment2.getAttributes().database_name,
        String(SELECTED_DB),
        'should have the selected database id as attribute for the second set'
      )
    }
  })
})
