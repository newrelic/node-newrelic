/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const LogAggregator = require('../../../lib/aggregators/log-aggregator')
const Metrics = require('../../../lib/metrics')
const sinon = require('sinon')
const helper = require('../../lib/agent_helper')

const RUN_ID = 1337
const LIMIT = 5

test('Log Aggregator', (t) => {
  t.autoend()
  let logEventAggregator
  let agentStub
  let log

  t.beforeEach(() => {
    agentStub = {
      getTransaction: sinon.stub()
    }
    // Normally this config is set after connect and in the actual
    // code we only use it after connect, but for unit testing
    // purposes, we'll set this here.
    agentStub.config = {
      event_harvest_config: {
        harvest_limits: {
          log_event_data: 42
        }
      }
    }
    logEventAggregator = new LogAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
      },
      {},
      new Metrics(5, {}, {}),
      agentStub
    )
    log = {
      'level': 30,
      'timestamp': '1649689872369',
      'pid': 4856,
      'hostname': 'test-host',
      'entity.name': 'unit-test',
      'entity.type': 'SERVICE',
      'trace.id': '2f93639c684a2dd33c28345173d218b8',
      'span.id': 'a136d77f2a5b997b',
      'entity.guid': 'MTkwfEFQTXxBUFBMSUNBVElPTnwyMjUzMDY0Nw',
      'message': 'unit test msg'
    }
  })

  t.afterEach(() => {
    logEventAggregator = null
    log = null
  })

  t.test('should set the correct default method', (t) => {
    const method = logEventAggregator.method

    t.equal(method, 'log_event_data')
    t.end()
  })

  t.test('toPayload() should return json format of data', (t) => {
    const logs = []

    for (let i = 0; i <= 8; i++) {
      logEventAggregator.add(log, '1')
      if (logs.length < 5) {
        logs.push(log)
      }
    }
    const payload = logEventAggregator._toPayloadSync()
    t.equal(payload.length, 1)
    t.same(payload, [{ logs: logs.reverse() }])
    t.end()
  })

  t.test('toPayload() should de-serialize a log if already JSON', (t) => {
    const log2 = JSON.stringify(log)
    logEventAggregator.add(log)
    logEventAggregator.add(log2)
    const payload = logEventAggregator._toPayloadSync()
    t.same(payload, [{ logs: [log, JSON.parse(log2)] }])
    t.end()
  })

  t.test('toPayload() should return nothing with no log event data', (t) => {
    const payload = logEventAggregator._toPayloadSync()

    t.notOk(payload)
    t.end()
  })

  t.test('should add log line to transaction when in transaction context', (t) => {
    const transaction = { logs: { add: sinon.stub() } }
    agentStub.getTransaction.returns(transaction)
    const line = { key: 'value' }
    logEventAggregator.add(line)
    t.ok(transaction.logs.add.callCount, 1, 'should add log to transaction')
    t.same(transaction.logs.add.args[0], [line])
    t.same(logEventAggregator.getEvents(), [], 'log aggregator should be empty')
    t.end()
  })

  t.test('should add log line to aggregator when not in transaction context', (t) => {
    const line = { key: 'value' }
    logEventAggregator.add(line)
    t.same(logEventAggregator.getEvents(), [line])
    t.end()
  })

  t.test('should add json log line to aggregator', (t) => {
    const line = { a: 'b' }
    const jsonLine = JSON.stringify(line)
    logEventAggregator.add(jsonLine)
    t.equal(logEventAggregator.getEvents().length, 1)
    t.same(
      logEventAggregator.getEvents(),
      [jsonLine],
      'log aggregator should not de-serialize if already string'
    )
    t.end()
  })

  t.test('should add logs to aggregator in batch with priority', (t) => {
    const logs = [{ a: 'b' }, { b: 'c' }, { c: 'd' }]
    const priority = Math.random() + 1
    logEventAggregator.addBatch(logs, priority)
    t.equal(logEventAggregator.getEvents().length, 3)
    t.end()
  })
})

test('big red button', (t) => {
  t.autoend()

  let agent

  t.beforeEach(() => {
    // setup agent
    agent = helper.instrumentMockedAgent()
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
  })

  t.test('should show logs if the config for it is enabled', (t) => {
    t.plan(2)

    agent.config.onConnect({
      event_harvest_config: {
        report_period_ms: 60,
        harvest_limits: {
          log_event_data: 42
        }
      }
    })
    agent.onConnect(false, () => {
      agent.logs.add({ msg: 'hello' })
      agent.logs.add({ msg: 'world' })
      const payload = agent.logs._toPayloadSync()
      const logMessages = payload[0].logs
      for (const msg of logMessages) {
        t.ok(['hello', 'world'].includes(msg.msg))
      }
    })
  })

  t.test('should drop logs if the server disabled logging', (t) => {
    t.plan(1)
    agent.config.onConnect({
      event_harvest_config: {
        report_period_ms: 60,
        harvest_limits: {
          log_event_data: 0
        }
      }
    })
    agent.onConnect(false, () => {
      agent.logs.add({ msg: 'hello' })
      agent.logs.add({ msg: 'world' })
      const payload = agent.logs._toPayloadSync()
      t.notOk(payload)
    })
  })
})
