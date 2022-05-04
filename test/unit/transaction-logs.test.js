/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Logs = require('../../lib/transaction/logs')
const { test } = require('tap')
const sinon = require('sinon')

test('Logs tests', (t) => {
  t.autoend()
  let logs
  let agent
  t.beforeEach(() => {
    const config = {
      event_harvest_config: {
        harvest_limits: {
          log_event_data: 2
        }
      }
    }
    agent = {
      logs: { addBatch: sinon.stub() },
      config
    }
    logs = new Logs(agent)
  })
  t.test('should initialize logs storage', (t) => {
    t.same(logs.storage, [], 'should init storage to empty')
    t.same(logs.aggregator, agent.logs, 'should create log aggregator')
    t.equal(logs.maxLimit, 2, 'should set max limit accordingly')
    t.end()
  })

  t.test('it should add logs to storage', (t) => {
    logs.add('line')
    t.same(logs.storage, ['line'])
    t.end()
  })

  t.test('it should not add data to storage if max limit has been met', (t) => {
    logs.add('line1')
    logs.add('line2')
    logs.add('line3')
    t.same(logs.storage, ['line1', 'line2'])
    t.end()
  })

  t.test('it should flush the batch', (t) => {
    logs.add('line')
    logs.flush('1.10')
    t.ok(logs.aggregator.addBatch.callCount, 1, 'should call addBatch once')
    t.same(logs.aggregator.addBatch.args[0], [['line'], '1.10'])
    t.end()
  })
})
