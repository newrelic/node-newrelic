/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - getLinkingMetadata', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'should return available fields, no DT data, when DT disabled in transaction',
    (t, end) => {
      const { agent, api } = t.nr
      agent.config.distributed_tracing.enabled = false

      helper.runInTransaction(agent, function () {
        const metadata = api.getLinkingMetadata()

        // trace and span id are omitted when dt is disabled
        assert.ok(!metadata['trace.id'])
        assert.ok(!metadata['span.id'])
        assert.equal(metadata['entity.name'], 'New Relic for Node.js tests')
        assert.equal(metadata['entity.type'], 'SERVICE')
        assert.ok(!metadata['entity.guid'])
        assert.equal(metadata.hostname, agent.config.getHostnameSafe())

        end()
      })
    }
  )

  await t.test(
    'should return available fields, no DT data, when DT enabled - no transaction',
    (t, end) => {
      const { agent, api } = t.nr
      agent.config.distributed_tracing.enabled = true

      const metadata = api.getLinkingMetadata()

      // Trace and span id are omitted when there is no active transaction
      assert.ok(!metadata['trace.id'])
      assert.ok(!metadata['span.id'])
      assert.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      assert.equal(metadata['entity.type'], 'SERVICE')
      assert.ok(!metadata['entity.guid'])
      assert.equal(metadata.hostname, agent.config.getHostnameSafe())

      end()
    }
  )

  await t.test('should return all data, when DT enabled in transaction', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, function () {
      const metadata = api.getLinkingMetadata()

      assert.ok(metadata['trace.id'])
      assert.equal(typeof metadata['trace.id'], 'string')

      assert.ok(metadata['span.id'])
      assert.equal(typeof metadata['span.id'], 'string')

      assert.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      assert.equal(metadata['entity.type'], 'SERVICE')
      assert.ok(!metadata['entity.guid'])
      assert.equal(metadata.hostname, agent.config.getHostnameSafe())

      end()
    })
  })

  await t.test('should include entity_guid when set and DT enabled in transaction', (t, end) => {
    const { agent, api } = t.nr
    const expectedEntityGuid = 'test'
    agent.config.entity_guid = expectedEntityGuid

    helper.runInTransaction(agent, function () {
      const metadata = api.getLinkingMetadata()

      assert.ok(metadata['trace.id'])
      assert.equal(typeof metadata['trace.id'], 'string')

      assert.ok(metadata['span.id'])
      assert.equal(typeof metadata['span.id'], 'string')

      assert.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      assert.equal(metadata['entity.type'], 'SERVICE')

      assert.ok(metadata['entity.guid'])
      assert.equal(metadata['entity.guid'], expectedEntityGuid)

      assert.equal(metadata.hostname, agent.config.getHostnameSafe())

      end()
    })
  })
})
