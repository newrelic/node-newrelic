/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LogAggregator = require('../../../lib/aggregators/log-aggregator')
const Metrics = require('../../../lib/metrics')
const helper = require('../../lib/agent_helper')

const RUN_ID = 1337
const LIMIT = 5

test('Log Aggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}

    ctx.nr.txReturn = undefined
    ctx.nr.commonAttrs = {
      'entity.guid': 'MTkwfEFQTXxBUFBMSUNBVElPTnwyMjUzMDY0Nw',
      'hostname': 'test-host',
      'entity.name': 'unit-test',
      'entity.type': 'SERVICE'
    }
    ctx.nr.agent = {
      getTransaction() {
        return ctx.nr.txReturn
      },
      getServiceLinkingMetadata() {
        return ctx.nr.commonAttrs
      },
      collector: {},
      metrics: new Metrics(5, {}, {}),
      harvester: { add() {} },

      config: {
        event_harvest_config: {
          harvest_limits: {
            log_event_data: 42
          }
        }
      }
    }

    ctx.nr.logEventAggregator = new LogAggregator({ runId: RUN_ID, limit: LIMIT }, ctx.nr.agent)

    ctx.nr.log = {
      'level': 30,
      'timestamp': '1649689872369',
      'pid': 4856,
      'trace.id': '2f93639c684a2dd33c28345173d218b8',
      'span.id': 'a136d77f2a5b997b',
      'message': 'unit test msg'
    }
  })

  await t.test('should set the correct default method', (t) => {
    const { logEventAggregator } = t.nr
    const method = logEventAggregator.method
    assert.equal(method, 'log_event_data')
  })

  await t.test('toPayload() should return json format of data', (t) => {
    const { logEventAggregator, log, commonAttrs } = t.nr
    const logs = []

    for (let i = 0; i <= 8; i += 1) {
      logEventAggregator.add(log, '1')
      if (logs.length < 5) {
        logs.push(log)
      }
    }
    const payload = logEventAggregator._toPayloadSync()
    assert.equal(payload.length, 1)
    assert.deepStrictEqual(payload, [{ common: { attributes: commonAttrs }, logs: logs.reverse() }])
  })

  await t.test(
    'toPayload() should execute formatter function when an entry in aggregator is a function',
    (t) => {
      const { commonAttrs, logEventAggregator, log } = t.nr
      const log2 = JSON.stringify(log)
      function formatLog() {
        return JSON.parse(log2)
      }
      logEventAggregator.add(log)
      logEventAggregator.add(formatLog)
      const payload = logEventAggregator._toPayloadSync()
      assert.deepStrictEqual(payload, [
        { common: { attributes: commonAttrs }, logs: [log, JSON.parse(log2)] }
      ])
    }
  )

  await t.test('toPayload() should only return logs that have data', (t) => {
    const { commonAttrs, logEventAggregator, log } = t.nr
    const log2 = JSON.stringify(log)
    function formatLog() {
      return JSON.parse(log2)
    }
    function formatLog2() {
      return
    }
    logEventAggregator.add(log)
    logEventAggregator.add(formatLog)
    logEventAggregator.add(formatLog2)
    const payload = logEventAggregator._toPayloadSync()
    assert.deepStrictEqual(payload, [
      { common: { attributes: commonAttrs }, logs: [log, JSON.parse(log2)] }
    ])
  })

  await t.test('toPayload() should return nothing with no log event data', (t) => {
    const { logEventAggregator } = t.nr
    const payload = logEventAggregator._toPayloadSync()
    assert.equal(payload, undefined)
  })

  await t.test('toPayload() should return nothing when log functions return no data', (t) => {
    const { logEventAggregator } = t.nr
    function formatLog() {
      return
    }
    logEventAggregator.add(formatLog)
    const payload = logEventAggregator._toPayloadSync()
    assert.equal(payload, undefined)
  })

  await t.test('should add log line to transaction when in transaction context', (t) => {
    const { logEventAggregator } = t.nr
    const line = { key: 'value' }
    let addCount = 0
    let addArgs
    t.nr.txReturn = {
      logs: {
        add(...args) {
          addCount += 1
          addArgs = args
        }
      }
    }

    logEventAggregator.add(line)
    assert.equal(addCount, 1, 'should add log to transaction')
    assert.deepStrictEqual(addArgs, [line])
    assert.deepStrictEqual(logEventAggregator.getEvents(), [], 'log aggregator should be empty')
  })

  await t.test('should add log line to aggregator when not in transaction context', (t) => {
    const { logEventAggregator } = t.nr
    const line = { key: 'value' }
    logEventAggregator.add(line)
    assert.deepStrictEqual(logEventAggregator.getEvents(), [line])
  })

  await t.test('should add json log line to aggregator', (t) => {
    const { logEventAggregator } = t.nr
    const line = { a: 'b' }
    const jsonLine = JSON.stringify(line)
    logEventAggregator.add(jsonLine)
    assert.deepStrictEqual(
      logEventAggregator.getEvents(),
      [jsonLine],
      'log aggregator should not de-serialize if already string'
    )
  })

  await t.test('should add logs to aggregator in batch with priority', (t) => {
    const { logEventAggregator } = t.nr
    const logs = [{ a: 'b' }, { b: 'c' }, { c: 'd' }]
    const priority = Math.random() + 1
    logEventAggregator.addBatch(logs, priority)
    assert.equal(logEventAggregator.getEvents().length, 3)
  })
})

test('big red button', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should show logs if the config for it is enabled', (t, end) => {
    const { agent } = t.nr
    agent.config.onConnect({
      event_harvest_config: {
        report_period_ms: 60,
        harvest_limits: { log_event_data: 42 }
      }
    })
    agent.onConnect(false, () => {
      agent.logs.add({ msg: 'hello' })
      agent.logs.add({ msg: 'world' })
      const payload = agent.logs._toPayloadSync()
      const logMessages = payload[0].logs
      for (const msg of logMessages) {
        assert.equal(['hello', 'world'].includes(msg.msg), true)
      }
      end()
    })
  })

  await t.test('should drop logs if the server disabled logging', (t, end) => {
    const { agent } = t.nr
    agent.config.onConnect({
      event_harvest_config: {
        report_period_ms: 60,
        harvest_limits: { log_event_data: 0 }
      }
    })
    agent.onConnect(false, () => {
      agent.logs.add({ msg: 'hello' })
      agent.logs.add({ msg: 'world' })
      const payload = agent.logs._toPayloadSync()
      assert.equal(payload, undefined)
      end()
    })
  })
})
