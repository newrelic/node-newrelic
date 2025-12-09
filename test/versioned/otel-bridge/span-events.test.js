/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const helper = require('../../lib/agent_helper')
const { createServer } = require('../../lib/undici-mock-server')
const assert = require('node:assert')
// const { assertSegments } = require('../../lib/custom-assertions')

test('should properly name segments', async (t) => {
  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      undici: {
        enabled: false
      },
      http: {
        enabled: false
      }
    },
    opentelemetry: {
      enabled: true,
      traces: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const { UndiciInstrumentation } = require('@opentelemetry/instrumentation-undici')

  const requestHook = (span, request) => {
    // Add a custom event to the OTEL span
    span.addEvent('custom.request.event', {
      'event.type': 'custom',
      'request.url': request.origin + request.path,
      'custom.attribute': 'test-value'
    })
  }

  const responseHook = (span, response) => {
    // Add a custom event to the OTEL span
    span.addEvent('custom.response.event', {
      'event.type': 'custom',
      'response.status_code': response.statusCode,
      'custom.attribute': 'test-value'
    })
  }

  const startSpanHook = (span) => {
    // Add a custom event to the OTEL span
    span.addEvent('custom.start.event', {
      'event.type': 'custom',
      'custom.attribute': 'test-value'
    })
  }

  registerInstrumentations([
    new UndiciInstrumentation({
      requestHook,
      responseHook,
      startSpanHook
    })
  ])

  const { server, HOST, REQUEST_URL } = createServer()

  t.after(() => {
    helper.unloadAgent(agent)
    server.close()
  })

  await helper.runInTransaction(agent, async (tx) => {
    const { status } = await fetch(`${REQUEST_URL}/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application.json'
      },
      body: Buffer.from('{"key":"value"}')
    })
    assert.equal(status, 200)
    tx.end()
  })
})
