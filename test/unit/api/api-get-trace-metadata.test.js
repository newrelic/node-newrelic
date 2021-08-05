/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - trace metadata', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    agent.config.distributed_tracing.enabled = true

    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('exports a trace metadata function', (t) => {
    helper.runInTransaction(agent, function (txn) {
      t.type(api.getTraceMetadata, 'function')

      const metadata = api.getTraceMetadata()
      t.type(metadata, 'object')

      t.type(metadata.traceId, 'string')
      t.equal(metadata.traceId, txn.traceId)

      t.type(metadata.spanId, 'string')
      t.equal(metadata.spanId, txn.agent.tracer.getSegment().id)

      t.end()
    })
  })

  t.test('should return empty object with DT disabled', (t) => {
    agent.config.distributed_tracing.enabled = false

    helper.runInTransaction(agent, function () {
      const metadata = api.getTraceMetadata()
      t.type(metadata, 'object')

      t.same(metadata, {})
      t.end()
    })
  })

  t.test('should not include spanId property with span events disabled', (t) => {
    agent.config.span_events.enabled = false

    helper.runInTransaction(agent, function (txn) {
      const metadata = api.getTraceMetadata()
      t.type(metadata, 'object')

      t.type(metadata.traceId, 'string')
      t.equal(metadata.traceId, txn.traceId)

      const hasProperty = Object.hasOwnProperty.call(metadata, 'spanId')
      t.notOk(hasProperty)

      t.end()
    })
  })
})
