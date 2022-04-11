/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const LogAggregator = require('../../../lib/aggregators/log-aggregator')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const LIMIT = 5

test('Log Aggregator', (t) => {
  t.autoend()
  let logEventAggregator

  t.beforeEach(() => {
    logEventAggregator = new LogAggregator(
      {
        runId: RUN_ID,
        limit: LIMIT
      },
      {},
      new Metrics(5, {}, {})
    )
  })

  t.afterEach(() => {
    logEventAggregator = null
  })

  t.test('should set the correct default method', (t) => {
    const method = logEventAggregator.method

    t.equal(method, 'log_event_data')
    t.end()
  })

  t.test('toPayload() should return json format of data', (t) => {
    const log = {
      'level': 30,
      'timestamp': '1649689872369',
      'pid': 4856,
      'hostname': 'test-host',
      'entity.name': 'unit-test',
      'entity.type': 'SERVICE',
      'hostname': 'test-host',
      'trace.id': '2f93639c684a2dd33c28345173d218b8',
      'span.id': 'a136d77f2a5b997b',
      'entity.guid': 'MTkwfEFQTXxBUFBMSUNBVElPTnwyMjUzMDY0Nw',
      'message': 'unit test msg'
    }
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

  t.test('toPayload() should return nothing with no log event data', (t) => {
    const payload = logEventAggregator._toPayloadSync()

    t.notOk(payload)
    t.end()
  })
})
