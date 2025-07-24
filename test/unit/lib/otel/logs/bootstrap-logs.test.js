/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { EventEmitter } = require('node:events')

const bootstrapLogs = require('#agentlib/otel/logs/bootstrap-logs.js')

test('logs notice when application logging is disabled', () => {
  const agent = {
    config: {
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
      host: 'example.com',
      port: 443,
      opentelemetry_bridge: {
        enabled: true,
        logs: { enabled: false }
      },
      application_logging: {
        enabled: false
      }
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)

  const logs = []
  const logger = {
    info(...args) {
      logs.push(args)
    }
  }

  bootstrapLogs({ agent, logger })

  assert.deepStrictEqual(logs, [['application logging disabled, skipping otel logs setup']])
})
