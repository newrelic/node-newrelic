/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { once, EventEmitter } = require('node:events')
const tspl = require('@matteo.collina/tspl')

const SetupMetrics = require('#agentlib/otel/metrics/index.js')

test('configures global provider after agent start', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const agent = {
    get [Symbol.toStringTag]() { return 'Agent' },
    config: {
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
      host: 'example.com',
      port: 443,
      opentelemetry_bridge: {
        metrics: {
          enabled: true,
          exportInterval: 1_000,
          exportTimeout: 1_000
        }
      }
    },
    metrics: {
      getOrCreateMetric(name) {
        plan.equal(name, 'Supportability/Metrics/Nodejs/OpenTelemetryBridge/enabled')
        return this
      },
      incrementCallCount() {
        plan.ok(true)
      }
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)

  const signal = new SetupMetrics({ agent })
  plan.ok(signal)

  plan.equal(1, agent.listenerCount('started'))
  process.nextTick(() => agent.emit('started'))

  await once(agent, 'started')
  plan.equal(0, agent.listenerCount('started'))

  await once(agent, 'otelMetricsBootstrapped')
  const provider = require('@opentelemetry/api').metrics.getMeterProvider()
  plan.deepEqual(provider._sharedState.resource.attributes, { 'entity.guid': 'guid-123456' })

  await plan
})
