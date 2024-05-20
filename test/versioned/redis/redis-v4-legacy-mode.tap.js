/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 2

test('Redis instrumentation', function (t) {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null

  let agent
  let client

  t.beforeEach(async function () {
    agent = helper.instrumentMockedAgent()

    const redis = require('redis')
    client = redis.createClient({
      legacyMode: true,
      socket: { port: params.redis_port, host: params.redis_host }
    })

    await client.connect()
    await client.v4.flushAll()

    await client.v4.select(DB_INDEX)
    // eslint-disable-next-line new-cap

    METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

    // need to capture attributes
    agent.config.attributes.enabled = true
  })

  t.afterEach(async function () {
    agent && helper.unloadAgent(agent)
    if (client) {
      await client.v4.flushAll()
      await client.v4.quit()
    }
    // must purge require cache of redis related instrumentation
    // otherwise it will not re-register on subsequent test runs
    removeMatchedModules(/redis/)
  })

  t.test('should find Redis calls in the transaction trace', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')

      const ok = await client.v4.set('testkey', 'arglbargle')
      t.ok(agent.getTransaction(), 'transaction should still be visible')
      t.ok(ok, 'everything should be peachy after setting')

      const value = await client.v4.get('testkey')
      t.ok(agent.getTransaction(), 'transaction should still still be visible')
      t.equal(value, 'arglbargle', 'redis client should still work')

      const trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')
      t.equal(trace.root.children.length, 2, 'there should be only two children of the root')

      const setSegment = trace.root.children[0]
      const setAttributes = setSegment.getAttributes()
      t.ok(setSegment, 'trace segment for set should exist')
      t.equal(setSegment.name, 'Datastore/operation/Redis/set', 'should register the set')
      t.equal(setAttributes.key, '"testkey"', 'should have the set key as a attribute')
      t.equal(setSegment.children.length, 0, 'set should have no children')

      const getSegment = trace.root.children[1]
      const getAttributes = getSegment.getAttributes()
      t.ok(getSegment, 'trace segment for get should exist')

      t.equal(getSegment.name, 'Datastore/operation/Redis/get', 'should register the get')

      t.equal(getAttributes.key, '"testkey"', 'should have the get key as a attribute')

      t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
      t.end()
    })
  })

  t.test('should create correct metrics', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.v4.set('testkey', 'arglbargle')
      await client.v4.get('testkey')
      transaction.end()
      const unscoped = transaction.metrics.unscoped
      const expected = {
        'Datastore/all': 2,
        'Datastore/allWeb': 2,
        'Datastore/Redis/all': 2,
        'Datastore/Redis/allWeb': 2,
        'Datastore/operation/Redis/set': 1,
        'Datastore/operation/Redis/get': 1
      }
      checkMetrics(t, unscoped, expected)
      t.end()
    })
  })

  t.test('should add `key` attribute to trace segment', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    agent.config.attributes.enabled = true

    helper.runInTransaction(agent, async function () {
      await client.v4.set('saveme', 'foobar')

      const segment = agent.tracer.getSegment().children[0]
      t.equal(segment.getAttributes().key, '"saveme"', 'should have `key` attribute')
      t.end()
    })
  })

  t.test('should not add `key` attribute to trace segment', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    agent.config.attributes.enabled = false

    helper.runInTransaction(agent, async function () {
      await client.v4.set('saveme', 'foobar')

      const segment = agent.tracer.getSegment().children[0]
      t.notOk(segment.getAttributes().key, 'should not have `key` attribute')
      t.end()
    })
  })

  t.test('should add datastore instance attributes to trace segments', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.v4.set('testkey', 'arglbargle')

      const trace = transaction.trace
      const setSegment = trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equal(attributes.host, METRIC_HOST_NAME, 'should have host as attribute')
      t.equal(
        attributes.port_path_or_id,
        String(params.redis_port),
        'should have port as attribute'
      )
      t.equal(attributes.database_name, String(DB_INDEX), 'should have database id as attribute')
      t.equal(attributes.product, 'Redis', 'should have product attribute')
      t.end()
    })
  })

  t.test('should not add instance attributes/metrics when disabled', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.v4.set('testkey', 'arglbargle')

      const setSegment = transaction.trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equal(attributes.host, undefined, 'should not have host attribute')
      t.equal(attributes.port_path_or_id, undefined, 'should not have port attribute')
      t.equal(attributes.database_name, undefined, 'should not have db name attribute')

      transaction.end()
      const unscoped = transaction.metrics.unscoped
      t.equal(
        unscoped['Datastore/instance/Redis/' + HOST_ID],
        undefined,
        'should not have instance metric'
      )
      t.end()
    })
  })

  t.test('should follow selected database', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    let transaction = null
    const SELECTED_DB = 3
    helper.runInTransaction(agent, async function (tx) {
      transaction = tx
      await client.v4.set('select:test:key', 'foo')
      t.ok(agent.getTransaction(), 'should not lose transaction state')

      await client.v4.select(SELECTED_DB)
      t.ok(agent.getTransaction(), 'should not lose transaction state')

      await client.v4.set('select:test:key:2', 'bar')
      t.ok(agent.getTransaction(), 'should not lose transaction state')
      transaction.end()
      verify()
      t.end()
    })

    function verify() {
      const setSegment1 = transaction.trace.root.children[0]
      const selectSegment = transaction.trace.root.children[1]
      const setSegment2 = transaction.trace.root.children[2]

      t.equal(setSegment1.name, 'Datastore/operation/Redis/set', 'should register the first set')
      t.equal(
        setSegment1.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the first set'
      )
      t.equal(selectSegment.name, 'Datastore/operation/Redis/select', 'should register the select')
      t.equal(
        selectSegment.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the select'
      )
      t.equal(setSegment2.name, 'Datastore/operation/Redis/set', 'should register the second set')
      t.equal(
        setSegment2.getAttributes().database_name,
        String(SELECTED_DB),
        'should have the selected database id as attribute for the second set'
      )
    }
  })
})

function checkMetrics(t, metrics, expected) {
  Object.keys(expected).forEach(function (name) {
    t.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      t.equal(
        metrics[name].callCount,
        expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}
