/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import params from '../../lib/params.js'
import urltils from '../../../lib/util/urltils.js'
import { tspl } from '@matteo.collina/tspl'
import assertions from '../../lib/custom-assertions/index.js'
const { assertMetrics } = assertions
import { removeModules } from '../../lib/cache-buster.js'

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 5

test('ioredis instrumentation', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.instrumentMockedAgent()
    const redis = await import('ioredis')
    const Redis = redis.default || redis.Redis
    const redisClient = new Redis(params.redis_port, params.redis_host)
    await redisClient.flushall()
    const METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    const HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port
    const redisKey = helper.randomString('redis-key')

    await redisClient.select(DB_INDEX)
    ctx.nr = {
      agent,
      redisClient,
      redisKey,
      HOST_ID,
      METRIC_HOST_NAME
    }
  })

  t.afterEach((ctx) => {
    const { agent, redisClient } = ctx.nr
    helper.unloadAgent(agent)
    removeModules(['ioredis'])
    redisClient.disconnect()
  })

  await t.test('creates expected metrics', async (t) => {
    const { agent, redisClient, redisKey, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 6 })
    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]
      expected['Datastore/instance/Redis/' + HOST_ID] = 2

      assertMetrics(tx.metrics, expected, false, false, { assert: plan })
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set(redisKey, 'testvalue')
      transaction.end()
    })

    await plan.completed
  })

  await t.test('creates expected segments', async (t) => {
    const { agent, redisClient, redisKey } = t.nr
    const plan = tspl(t, { plan: 5 })

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 2, 'root has two children')

      const [setSegment, getSegment] = children

      plan.equal(setSegment.name, 'Datastore/operation/Redis/set')

      // ioredis operations return promise, any 'then' callbacks will be sibling segments
      // of the original redis call
      plan.equal(getSegment.name, 'Datastore/operation/Redis/get')
      const getChildren = tx.trace.getChildren(getSegment.id)
      plan.equal(getChildren.length, 0, 'should not contain any segments')
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set(redisKey, 'testvalue')
      const value = await redisClient.get(redisKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should add instance attributes to all redis segments', async (t) => {
    const { agent, redisClient, redisKey, METRIC_HOST_NAME } = t.nr
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true
    const plan = tspl(t, { plan: 12 })
    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 2, 'root has two children')

      const [setSegment, getSegment] = children
      const setAttrs = setSegment.getAttributes()
      const getAttrs = getSegment.getAttributes()
      plan.equal(setAttrs.host, METRIC_HOST_NAME)
      plan.equal(setAttrs.product, 'Redis')
      plan.equal(setAttrs.key, `"${redisKey}"`)
      plan.equal(setAttrs.port_path_or_id, params.redis_port.toString())
      plan.equal(setAttrs.database_name, String(DB_INDEX))
      plan.equal(getAttrs.host, METRIC_HOST_NAME)
      plan.equal(getAttrs.product, 'Redis')
      plan.equal(getAttrs.key, `"${redisKey}"`)
      plan.equal(getAttrs.port_path_or_id, params.redis_port.toString())
      plan.equal(getAttrs.database_name, String(DB_INDEX))
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set(redisKey, 'testvalue')
      const value = await redisClient.get(redisKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should not add instance attributes to redis segments when disabled', async (t) => {
    const { agent, redisClient, redisKey, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 13 })
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 2, 'root has two children')

      const [setSegment, getSegment] = children
      const setAttrs = setSegment.getAttributes()
      const getAttrs = getSegment.getAttributes()
      plan.equal(setAttrs.host, undefined)
      plan.equal(setAttrs.product, 'Redis')
      plan.equal(setAttrs.key, `"${redisKey}"`)
      plan.equal(setAttrs.port_path_or_id, undefined)
      plan.equal(setAttrs.database_name, undefined)
      plan.equal(getAttrs.host, undefined)
      plan.equal(getAttrs.product, 'Redis')
      plan.equal(getAttrs.key, `"${redisKey}"`)
      plan.equal(getAttrs.port_path_or_id, undefined)
      plan.equal(getAttrs.database_name, undefined)
      const unscoped = tx.metrics.unscoped
      plan.equal(unscoped[`Datastore/instance/Redis/${HOST_ID}`], undefined)
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set(redisKey, 'testvalue')
      const value = await redisClient.get(redisKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should follow selected database', async (t) => {
    const { agent, redisClient, redisKey } = t.nr
    const plan = tspl(t, { plan: 7 })
    const SELECTED_DB = 8

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 3, 'root has two children')

      const [setSegment, selectSegment, setSegment2] = children
      plan.equal(setSegment.name, 'Datastore/operation/Redis/set')
      plan.equal(setSegment.getAttributes().database_name, String(DB_INDEX))
      plan.equal(selectSegment.name, 'Datastore/operation/Redis/select')
      plan.equal(selectSegment.getAttributes().database_name, String(DB_INDEX))
      plan.equal(setSegment2.name, 'Datastore/operation/Redis/set')
      plan.equal(setSegment2.getAttributes().database_name, String(SELECTED_DB))
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set(redisKey, 'testvalue')
      await redisClient.select(SELECTED_DB)
      await redisClient.set(`${redisKey}2`, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  // NODE-1524 regression
  await t.test('does not crash when ending out of transaction', (t, end) => {
    const { agent, redisClient, redisKey } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      assert.ok(agent.getTransaction(), 'transaction should be in progress')
      redisClient.set(redisKey, 'testvalue').then(function () {
        assert.ok(!agent.getTransaction(), 'transaction should have ended')
        end()
      })
      transaction.end()
    })
  })
})
