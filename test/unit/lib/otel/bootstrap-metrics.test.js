/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once, EventEmitter } = require('node:events')

const bootstrapMetrics = require('#agentlib/otel/bootstrap-metrics.js')

test('configures global provider after agent start', async (t) => {
  const agent = {
    config: {
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
      host: 'example.com'
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)

  bootstrapMetrics(agent)

  assert.equal(1, agent.listenerCount('started'))
  process.nextTick(() => agent.emit('started'))

  await once(agent, 'started')
  assert.equal(0, agent.listenerCount('started'))

  const provider = require('@opentelemetry/api').metrics.getMeterProvider()
  assert.deepEqual(provider._sharedState.resource.attributes, { 'entity.guid': 'guid-123456' })
})
