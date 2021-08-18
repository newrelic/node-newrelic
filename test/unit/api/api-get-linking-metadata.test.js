/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - getLinkingMetadata', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('should return available fields, no DT data, when DT disabled in transaction', (t) => {
    agent.config.distributed_tracing.enabled = false

    helper.runInTransaction(agent, function () {
      const metadata = api.getLinkingMetadata()

      // trace and span id are omitted when dt is disabled
      t.notOk(metadata['trace.id'])
      t.notOk(metadata['span.id'])
      t.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      t.equal(metadata['entity.type'], 'SERVICE')
      t.notOk(metadata['entity.guid'])
      t.equal(metadata.hostname, agent.config.getHostnameSafe())

      t.end()
    })
  })

  t.test('should return available fields, no DT data, when DT enabled - no transaction', (t) => {
    agent.config.distributed_tracing.enabled = true

    const metadata = api.getLinkingMetadata()

    // Trace and span id are omitted when there is no active transaction
    t.notOk(metadata['trace.id'])
    t.notOk(metadata['span.id'])
    t.equal(metadata['entity.name'], 'New Relic for Node.js tests')
    t.equal(metadata['entity.type'], 'SERVICE')
    t.notOk(metadata['entity.guid'])
    t.equal(metadata.hostname, agent.config.getHostnameSafe())

    t.end()
  })

  t.test('should return all data, when DT enabled in transaction', (t) => {
    helper.runInTransaction(agent, function () {
      const metadata = api.getLinkingMetadata()

      t.ok(metadata['trace.id'])
      t.type(metadata['trace.id'], 'string')

      t.ok(metadata['span.id'])
      t.type(metadata['span.id'], 'string')

      t.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      t.equal(metadata['entity.type'], 'SERVICE')
      t.notOk(metadata['entity.guid'])
      t.equal(metadata.hostname, agent.config.getHostnameSafe())

      t.end()
    })
  })

  t.test('should include entity_guid when set and DT enabled in transaction', (t) => {
    const expectedEntityGuid = 'test'
    agent.config.entity_guid = expectedEntityGuid

    helper.runInTransaction(agent, function () {
      const metadata = api.getLinkingMetadata()

      t.ok(metadata['trace.id'])
      t.type(metadata['trace.id'], 'string')

      t.ok(metadata['span.id'])
      t.type(metadata['span.id'], 'string')

      t.equal(metadata['entity.name'], 'New Relic for Node.js tests')
      t.equal(metadata['entity.type'], 'SERVICE')

      t.ok(metadata['entity.guid'])
      t.equal(metadata['entity.guid'], expectedEntityGuid)

      t.equal(metadata.hostname, agent.config.getHostnameSafe())

      t.end()
    })
  })
})
