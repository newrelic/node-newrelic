/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { once, EventEmitter } = require('node:events')
const tspl = require('@matteo.collina/tspl')

const bootstrapMetrics = require('#agentlib/otel/bootstrap-metrics.js')

test('configures global provider after agent start', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const agent = {
    config: {
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
      host: 'example.com',
      port: 443
    },
    metrics: {
      getOrCreateMetric(name) {
        plan.equal(name, 'Supportability/Nodejs/OpenTelemetryBridge/Metrics')
        return this
      },
      incrementCallCount() {
        plan.ok(true)
      }
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)

  bootstrapMetrics(agent)

  plan.equal(1, agent.listenerCount('started'))
  process.nextTick(() => agent.emit('started'))

  await once(agent, 'started')
  plan.equal(0, agent.listenerCount('started'))

  await once(agent, 'otelMetricsBootstrapped')
  const provider = require('@opentelemetry/api').metrics.getMeterProvider()
  plan.deepEqual(provider._sharedState.resource.attributes, { 'entity.guid': 'guid-123456' })

  await plan
})
