/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
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

// Indicates unique database in Valkey. 0-15 supported.
const DB_INDEX = 5

test('iovalkey instrumentation', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.instrumentMockedAgent()
    const valkey = await import('iovalkey')
    const Valkey = valkey.default || valkey.Valkey
    const valkeyClient = new Valkey(params.valkey_port, params.valkey_host)
    const METRIC_HOST_NAME = urltils.isLocalhost(params.valkey_host)
      ? agent.config.getHostnameSafe()
      : params.valkey_host
    const HOST_ID = METRIC_HOST_NAME + '/' + params.valkey_port
    const valkeyKey = helper.randomString('valkey-key')

    await valkeyClient.select(DB_INDEX)
    ctx.nr = {
      agent,
      valkeyClient,
      valkeyKey,
      HOST_ID,
      METRIC_HOST_NAME
    }
  })

  t.afterEach(async (ctx) => {
    const { agent, valkeyClient } = ctx.nr
    helper.unloadAgent(agent)
    removeModules(['iovalkey'])
    // re-select the default index for suite as some tests change it
    await valkeyClient.select(DB_INDEX)
    await valkeyClient.flushdb()
    valkeyClient.disconnect()
  })

  await t.test('creates expected metrics', async (t) => {
    const { agent, valkeyClient, valkeyKey, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 6 })
    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Valkey/all' }],
        [{ name: 'Datastore/operation/Valkey/set' }]
      ]
      expected['Datastore/instance/Valkey/' + HOST_ID] = 2

      assertMetrics(tx.metrics, expected, false, false, { assert: plan })
    })

    helper.runInTransaction(agent, async (transaction) => {
      await valkeyClient.set(valkeyKey, 'testvalue')
      transaction.end()
    })

    await plan.completed
  })

  await t.test('creates expected segments', async (t) => {
    const { agent, valkeyClient, valkeyKey } = t.nr
    const plan = tspl(t, { plan: 5 })

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 2, 'root has two children')

      const [setSegment, getSegment] = children

      plan.equal(setSegment.name, 'Datastore/operation/Valkey/set')

      // iovalkey operations return promise, any 'then' callbacks will be sibling segments
      // of the original valkey call
      plan.equal(getSegment.name, 'Datastore/operation/Valkey/get')
      const getChildren = tx.trace.getChildren(getSegment.id)
      plan.equal(getChildren.length, 0, 'should not contain any segments')
    })

    await helper.runInTransaction(agent, async (transaction) => {
      await valkeyClient.set(valkeyKey, 'testvalue')
      const value = await valkeyClient.get(valkeyKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should add instance attributes to all valkey segments', async (t) => {
    const { agent, valkeyClient, valkeyKey, METRIC_HOST_NAME } = t.nr
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
      plan.equal(setAttrs.product, 'Valkey')
      plan.equal(setAttrs.key, `"${valkeyKey}"`)
      plan.equal(setAttrs.port_path_or_id, params.valkey_port.toString())
      plan.equal(setAttrs.database_name, String(DB_INDEX))
      plan.equal(getAttrs.host, METRIC_HOST_NAME)
      plan.equal(getAttrs.product, 'Valkey')
      plan.equal(getAttrs.key, `"${valkeyKey}"`)
      plan.equal(getAttrs.port_path_or_id, params.valkey_port.toString())
      plan.equal(getAttrs.database_name, String(DB_INDEX))
    })

    helper.runInTransaction(agent, async (transaction) => {
      await valkeyClient.set(valkeyKey, 'testvalue')
      const value = await valkeyClient.get(valkeyKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should not add instance attributes to valkey segments when disabled', async (t) => {
    const { agent, valkeyClient, valkeyKey, HOST_ID } = t.nr
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
      plan.equal(setAttrs.product, 'Valkey')
      plan.equal(setAttrs.key, `"${valkeyKey}"`)
      plan.equal(setAttrs.port_path_or_id, undefined)
      plan.equal(setAttrs.database_name, undefined)
      plan.equal(getAttrs.host, undefined)
      plan.equal(getAttrs.product, 'Valkey')
      plan.equal(getAttrs.key, `"${valkeyKey}"`)
      plan.equal(getAttrs.port_path_or_id, undefined)
      plan.equal(getAttrs.database_name, undefined)
      const unscoped = tx.metrics.unscoped
      plan.equal(unscoped[`Datastore/instance/Valkey/${HOST_ID}`], undefined)
    })

    helper.runInTransaction(agent, async (transaction) => {
      await valkeyClient.set(valkeyKey, 'testvalue')
      const value = await valkeyClient.get(valkeyKey)
      plan.equal(value, 'testvalue')
      transaction.end()
    })
    await plan.completed
  })

  await t.test('should follow selected database', async (t) => {
    const { agent, valkeyClient, valkeyKey } = t.nr
    const plan = tspl(t, { plan: 7 })
    const SELECTED_DB = 8

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      const children = tx.trace.getChildren(root.id)
      plan.equal(children.length, 3, 'root has two children')

      const [setSegment, selectSegment, setSegment2] = children
      plan.equal(setSegment.name, 'Datastore/operation/Valkey/set')
      plan.equal(setSegment.getAttributes().database_name, String(DB_INDEX))
      plan.equal(selectSegment.name, 'Datastore/operation/Valkey/select')
      plan.equal(selectSegment.getAttributes().database_name, String(DB_INDEX))
      plan.equal(setSegment2.name, 'Datastore/operation/Valkey/set')
      plan.equal(setSegment2.getAttributes().database_name, String(SELECTED_DB))
    })

    helper.runInTransaction(agent, async (transaction) => {
      await valkeyClient.set(valkeyKey, 'testvalue')
      await valkeyClient.select(SELECTED_DB)
      await valkeyClient.set(`${valkeyKey}2`, 'testvalue')
      transaction.end()
      // flushing index 8
      await valkeyClient.flushdb()
    })
    await plan.completed
  })

  // Regression test
  await t.test('does not crash when ending out of transaction', (t, end) => {
    const { agent, valkeyClient, valkeyKey } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      assert.ok(agent.getTransaction(), 'transaction should be in progress')
      valkeyClient.set(valkeyKey, 'testvalue').then(function () {
        assert.ok(!agent.getTransaction(), 'transaction should have ended')
        end()
      })
      transaction.end()
    })
  })
})
