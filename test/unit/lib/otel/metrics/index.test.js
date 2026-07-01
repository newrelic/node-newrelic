/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { once, EventEmitter } = require('node:events')

const SetupMetrics = require('#agentlib/otel/metrics/index.js')

test.beforeEach((ctx) => {
  ctx.nr = {}

  const agent = {
    get [Symbol.toStringTag]() { return 'Agent' },
    config: {
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
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
  t.plan(6)
  const { agent } = t.nr

  const signal = new SetupMetrics({ agent })
  t.assert.ok(signal)

  t.assert.equal(1, agent.listenerCount('started'))
  process.nextTick(() => agent.emit('started'))

  await once(agent, 'started')
  t.assert.equal(0, agent.listenerCount('started'))

  await once(agent, 'otelMetricsBootstrapped')
  const provider = require('@opentelemetry/api').metrics.getMeterProvider()
  t.assert.deepEqual(provider._sharedState.resource.attributes, { 'entity.guid': 'guid-123456' })
})

test('logs warning and uses defaults when export_interval <= export_timeout', async (t) => {
  t.plan(8)

  const { agent } = t.nr
  agent.config.opentelemetry.metrics.export_interval = 5_000
  agent.config.opentelemetry.metrics.export_timeout = 10_000

  let warnMessage = null
  const logger = {
    debugEnabled() {
      return false
    },
    traceEnabled() {
      return false
    },
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

test('forwards OTEL diagnostics to agent logger when debug logging is enabled', async (t) => {
  const { agent } = t.nr
  const { diag } = require('@opentelemetry/api')
  t.after(() => diag.disable())

  const debugMessages = []
  const logger = {
    debugEnabled() {
      return true
    },
    traceEnabled() {
      return false
    },
    warn() {},
    error() {},
    info() {},
    trace() {},
    debug(...args) {
      debugMessages.push(args)
    }
  }

  const signal = new SetupMetrics({ agent, logger })
  t.assert.ok(signal)

  diag.debug('test diagnostic message', { detail: 1 })
  const forwarded = debugMessages.find((args) => args[0] === 'test diagnostic message')
  t.assert.deepEqual(
    forwarded,
    ['test diagnostic message', { detail: 1 }],
    'OTEL diag debug logs should be forwarded to the agent logger'
  )
})

test('does not register a diag logger when debug and trace logging are disabled', async (t) => {
  const { agent } = t.nr
  const { diag } = require('@opentelemetry/api')
  t.after(() => diag.disable())

  const logger = {
    debugEnabled() {
      return false
    },
    traceEnabled() {
      return false
    },
    warn() {},
    debug() {
      t.assert.fail('agent logger should not receive forwarded diag logs')
    }
  }

  const signal = new SetupMetrics({ agent, logger })
  t.assert.ok(signal)

  // The default noop diag logger swallows this; nothing should reach the agent.
  diag.debug('should not be forwarded')
})
