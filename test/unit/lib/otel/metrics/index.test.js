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
        ctx.assert.equal(name, 'Supportability/Metrics/Nodejs/OpenTelemetryBridge/enabled')
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
