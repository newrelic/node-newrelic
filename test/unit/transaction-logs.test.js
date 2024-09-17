/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Logs = require('../../lib/transaction/logs')
const sinon = require('sinon')

test('Logs tests', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const config = {
      event_harvest_config: {
        harvest_limits: {
          log_event_data: 2
        }
      }
    }
    ctx.nr.agent = {
      logs: { addBatch: sinon.stub() },
      config
    }
    ctx.nr.logs = new Logs(ctx.nr.agent)
  })
  await t.test('should initialize logs storage', (t) => {
    const { agent, logs } = t.nr
    assert.deepEqual(logs.storage, [], 'should init storage to empty')
    assert.deepEqual(logs.aggregator, agent.logs, 'should create log aggregator')
    assert.equal(logs.maxLimit, 2, 'should set max limit accordingly')
  })

  await t.test('it should add logs to storage', (t) => {
    const { logs } = t.nr
    logs.add('line')
    assert.deepEqual(logs.storage, ['line'])
  })

  await t.test('it should not add data to storage if max limit has been met', (t) => {
    const { logs } = t.nr
    logs.add('line1')
    logs.add('line2')
    logs.add('line3')
    logs.add('line4')
    assert.deepEqual(logs.storage, ['line1', 'line2'])
  })

  await t.test('it should flush the batch', (t) => {
    const { logs } = t.nr
    logs.add('line')
    const priority = Math.random() + 1
    logs.flush(priority)
    assert.ok(logs.aggregator.addBatch.callCount, 1, 'should call addBatch once')
    assert.deepEqual(logs.aggregator.addBatch.args[0], [['line'], priority])
  })
})
