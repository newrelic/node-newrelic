/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const stream = require('node:stream')

const helper = require('../../lib/agent_helper')
const { removeMatchedModules } = require('../../lib/cache-buster')
const { LOGGING } = require('../../../lib/metrics/names')

process.env.OTEL_BLRP_SCHEDULE_DELAY = 1_000 // Interval for processor to ship logs

// `registerInstrumentations` patches the `pino` module via a require hook the
// first time it's called. It must only run once for the whole file -- each
// test below reloads `pino` fresh (via `removeMatchedModules`) so its
// `OTelPinoStream` binds to that test's own agent/LoggerProvider, rather than
// re-registering the instrumentation and risking double-patching the module.
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino')
registerInstrumentations([new PinoInstrumentation()])

function setup(applicationLogging) {
  removeMatchedModules(/pino/)

  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      pino: {
        enabled: false
      }
    },
    opentelemetry: {
      enabled: true,
      logs: { enabled: true }
    },
    application_logging: applicationLogging
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const dest = new stream.Writable({
    write(chunk, enc, cb) {
      cb()
    }
  })
  const logger = require('pino')({
    level: 'debug',
  }, dest)

  return { agent, logger }
}

test.afterEach((ctx) => {
  if (ctx.nr?.agent) {
    helper.unloadAgent(ctx.nr.agent)
  }
})

test('otel decorated logs do not overwrite NR data', (t, end) => {
  const { agent, logger } = setup({
    enabled: true,
    metrics: { enabled: false },
    forwarding: { enabled: true },
    local_decorating: { enabled: false }
  })
  t.nr = { agent }

  helper.runInTransaction(agent, (tx) => {
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
    assert.equal(log['otel.scope.name'], '@opentelemetry/instrumentation-pino')
    assert.equal(log['otel.library.name'], '@opentelemetry/instrumentation-pino')
    assert.equal(typeof log['otel.scope.version'], 'string')
    assert.equal(log['otel.scope.version'], log['otel.library.version'])

    end()
  })
})

test('otel decorated logs increment NR metrics', (t, end) => {
  const { agent, logger } = setup({
    enabled: true,
    metrics: { enabled: true },
    forwarding: { enabled: false },
    local_decorating: { enabled: false }
  })
  t.nr = { agent }

  helper.runInTransaction(agent, (tx) => {
    const logLevels = {
      debug: 5,
      info: 20,
      warn: 3,
      error: 2
    }
    for (const [logLevel, maxCount] of Object.entries(logLevels)) {
      for (let count = 0; count < maxCount; count++) {
        const msg = `This is log message #${count} at ${logLevel} level`
        logger[logLevel](msg)
      }
    }

    let grandTotal = 0
    for (const [logLevel, maxCount] of Object.entries(logLevels)) {
      grandTotal += maxCount
      const metricName = LOGGING.LEVELS[logLevel.toUpperCase()] || LOGGING.LEVELS.UNKNOWN
      const metric = agent.metrics.getMetric(metricName)
      assert.ok(metric, `ensure ${metricName} exists`)
      assert.equal(metric.callCount, maxCount, `ensure ${metricName} has the right value`)
    }

    const metricName = LOGGING.LINES
    const metric = agent.metrics.getMetric(metricName)
    assert.ok(metric, `ensure ${metricName} exists`)
    assert.equal(metric.callCount, grandTotal, `ensure ${metricName} has the right value`)
    end()
  })
})

test('does not create logging metrics when application_logging.metrics is disabled', (t, end) => {
  const { agent, logger } = setup({
    enabled: true,
    metrics: { enabled: false },
    forwarding: { enabled: true },
    local_decorating: { enabled: false }
  })
  t.nr = { agent }

  helper.runInTransaction(agent, (tx) => {
    logger.info({ foo: 'bar' }, 'hello world')

    const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.equal(linesMetric, undefined, `should not create ${LOGGING.LINES} metric`)
    const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
    assert.equal(levelMetric, undefined, `should not create ${LOGGING.LEVELS.INFO} metric`)

    assert.equal(tx.logs.storage.length, 1, 'should still forward the log')
    tx.end()

    const txLogs = tx.logs.aggregator.getEvents()
    assert.equal(txLogs.length, 1, 'should still forward the log when forwarding is enabled')
    assert.equal(txLogs[0].foo, 'bar')

    end()
  })
})

test('does not forward logs when application_logging.forwarding is disabled', (t, end) => {
  const { agent, logger } = setup({
    enabled: true,
    metrics: { enabled: true },
    forwarding: { enabled: false },
    local_decorating: { enabled: false }
  })
  t.nr = { agent }

  helper.runInTransaction(agent, (tx) => {
    logger.info({ foo: 'bar' }, 'hello world')

    const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.equal(linesMetric.callCount, 1, `should create ${LOGGING.LINES} metric`)
    const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
    assert.equal(levelMetric.callCount, 1, `should create ${LOGGING.LEVELS.INFO} metric`)

    assert.equal(tx.logs.storage.length, 0, 'should not forward the log')
    tx.end()

    const txLogs = tx.logs.aggregator.getEvents()
    assert.equal(txLogs.length, 0, 'should not forward the log when forwarding is disabled')

    end()
  })
})

test('does not count metrics nor forward logs when both application_logging.metrics and application_logging.forwarding are disabled', (t, end) => {
  // With metrics, forwarding, AND local_decorating all disabled,
  // `isApplicationLoggingEnabled` is false, so the OTEL logs bridge never
  // registers an `NrLoggerProvider` at all -- this exercises that early
  // bail-out path, not just the per-record gating in `nrEmitHandler`.
  const { agent, logger } = setup({
    enabled: true,
    metrics: { enabled: false },
    forwarding: { enabled: false },
    local_decorating: { enabled: false }
  })
  t.nr = { agent }

  helper.runInTransaction(agent, (tx) => {
    logger.info({ foo: 'bar' }, 'hello world')

    const linesMetric = agent.metrics.getMetric(LOGGING.LINES)
    assert.equal(linesMetric, undefined, `should not create ${LOGGING.LINES} metric`)
    const levelMetric = agent.metrics.getMetric(LOGGING.LEVELS.INFO)
    assert.equal(levelMetric, undefined, `should not create ${LOGGING.LEVELS.INFO} metric`)

    assert.equal(tx.logs.storage.length, 0, 'should not forward the log')
    tx.end()

    const txLogs = tx.logs.aggregator.getEvents()
    assert.equal(txLogs.length, 0, 'should not forward any logs')

    end()
  })
})
