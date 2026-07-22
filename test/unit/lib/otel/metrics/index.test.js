/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { once, EventEmitter } = require('node:events')

const SetupMetrics = require('#agentlib/otel/metrics/index.js')

/**
 * Builds a logger mock that records the messages passed to `debug` and `warn`.
 * `child` returns the same instance so nested loggers capture into the same
 * arrays.
 *
 * @returns {object} A logger with `debug`/`warn`/`child` plus `debugMessages`
 * and `warnCalls` capture arrays.
 */
function captureLogger() {
  const debugMessages = []
  const warnCalls = []
  const logger = {
    debugMessages,
    warnCalls,
    debug: (msg) => debugMessages.push(msg),
    warn: (...args) => warnCalls.push(args),
    audit() {},
    auditEnabled() { return false },
    child() { return this }
  }
  return logger
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  const guid = 'guid-123456'
  const licenseKey = 'license-123456'

  const agent = {
    get [Symbol.toStringTag]() { return 'Agent' },
    // SetupMetrics branches on this: `false` takes the standard `started`-event
    // path, `true` takes the serverless eager-exporter path.
    serverlessMode: false,
    config: {
      otlp_resource_attributes: {
        licenseKey,
        appName: 'test-app',
        'tags.accountId': '1',
        'tags.account': 'Test Account'
      },
      entity_guid: guid,
      license_key: licenseKey,
      host: 'example.com',
      port: 443,
      opentelemetry: {
        metrics: {
          enabled: true,
          export_interval: 1_000,
          export_timeout: 1_000
        }
      }
    },
    metrics: {
      getOrCreateMetric(name) {
        // Accept multiple metric names now that we record export success/failure
        const validMetrics = [
          'Supportability/Metrics/Nodejs/OpenTelemetryBridge/enabled',
          'Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/success',
          'Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/failure'
        ]
        ctx.assert.ok(validMetrics.includes(name), `Unexpected metric: ${name}`)
        return this
      },
      incrementCallCount() {
        ctx.assert.ok(true)
      }
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)

  ctx.nr.agent = agent
})

test('configures global provider after agent start', async (t) => {
  t.plan(10)
  const { agent } = t.nr

  const logger = captureLogger()
  const { debugMessages } = logger

  const signal = new SetupMetrics({ agent, logger })
  t.assert.ok(signal)

  t.assert.equal(1, agent.listenerCount('started'))
  // Bootstrapping is deferred to the `started` event, so it is logged up front
  // but the "finished" line has not been logged yet.
  t.assert.ok(
    debugMessages.includes('Waiting for agent connect to finish bootstrapping OTEL metrics.'),
    'should log that bootstrapping is deferred to agent connect'
  )
  process.nextTick(() => agent.emit('started'))

  await once(agent, 'started')
  t.assert.equal(0, agent.listenerCount('started'))

  await once(agent, 'otelMetricsBootstrapped')
  t.assert.ok(
    debugMessages.includes('Agent connect finished. Finishing boostrap of OTEL metrics.'),
    'should log that bootstrapping resumes once agent connect finishes'
  )
  const provider = require('@opentelemetry/api').metrics.getMeterProvider()
  t.assert.deepEqual(provider._sharedState.resource.attributes, {
    'entity.guid': 'guid-123456',
    'tags.accountId': '1',
    'tags.account': 'Test Account',
    appName: 'test-app',
    licenseKey: 'license-123456'
  })
})

test('logs warning and uses defaults when export_interval <= export_timeout', async (t) => {
  t.plan(8)

  const { agent } = t.nr
  agent.config.opentelemetry.metrics.export_interval = 5_000
  agent.config.opentelemetry.metrics.export_timeout = 10_000

  let warnMessage = null
  const logger = {
    debug() {},
    child() { return this },
    warn(...args) {
      warnMessage = args[0]
      t.assert.ok(args[0].includes('export_interval'))
      t.assert.ok(args[0].includes('export_timeout'))
      t.assert.equal(args[1], 5_000)
      t.assert.equal(args[2], 10_000)
    }
  }

  const signal = new SetupMetrics({ agent, logger })
  t.assert.ok(signal)
  t.assert.ok(warnMessage !== null, 'warning should have been logged')
})

test('serverless mode does not wait for the started event', (t) => {
  const { agent } = t.nr
  agent.serverlessMode = true

  const logger = captureLogger()
  const { debugMessages } = logger

  const signal = new SetupMetrics({ agent, logger })
  t.assert.ok(signal)

  // In serverless mode the exporter is finalized eagerly in the constructor,
  // so there is nothing to defer to the `started` event.
  t.assert.equal(agent.listenerCount('started'), 0)
  t.assert.ok(
    debugMessages.includes('Finalizing OTEL metrics in serverless mode.'),
    'should log that metrics are finalized eagerly in serverless mode'
  )
})

// `flushToString` drives a real collect -> export -> serialize cycle, which
// registers a global meter provider and reaches the network. To keep that off
// the shared global state exercised by the tests above, it lives in its own
// file: metrics-flush-to-string.test.js.
