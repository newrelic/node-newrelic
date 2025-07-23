/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const stream = require('node:stream')

const helper = require('../../lib/agent_helper')

test('otel decorated logs do not overwrite NR data', (t, end) => {
  process.env.OTEL_BLRP_SCHEDULE_DELAY = 1_000 // Interval for processor to ship logs

  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      pino: {
        enabled: false
      }
    },
    opentelemetry_bridge: {
      enabled: true,
      logs: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino')
  registerInstrumentations([new PinoInstrumentation()])

  const dest = new stream.Writable({
    write(chunk, enc, cb) {
      cb()
    }
  })
  const logger = require('pino')({
    level: 'info',
    stream: dest
  })

  helper.runInTransaction(agent, tx => {
    logger.info({ foo: 'bar' }, 'hello world')

    assert.equal(agent.logs.length, 0)
    assert.equal(tx.logs.storage.length, 1, 'should not get a duplicate log')

    const span = tx.trace.root
    tx.end()

    const txLogs = tx.logs.aggregator.getEvents()
    assert.equal(txLogs.length, 1)

    const log = txLogs[0]
    assert.equal(log['trace.id'], tx.traceId, 'trace id should be NR id')
    assert.equal(log['span.id'], span.id, 'span id should be NR id')
    assert.equal(log.foo, 'bar')

    end()
  })
})
