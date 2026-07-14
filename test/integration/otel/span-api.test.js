/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const otel = require('@opentelemetry/api')
const helper = require('#testlib/agent_helper.js')

// The Open Telemetry API provides developers with access to the active span
// so that they can decorate it. Frameworks, e.g. Next.js, that bundle direct
// OTEL tracing support utilize this API to get and work with the active span.
// As a consequence, our FakeSpan must expose the API surface those users are
// expecting. This test verifies that we expose said surface such that those
// implementations "work."
test('otel span api provides necessary interface', (t, end) => {
  const agent = helper.instrumentMockedAgent({
    opentelemetry: {
      enabled: true,
      traces: { enabled: true }
    }
  })

  helper.runInTransaction(agent, () => {
    const span = otel.trace.getActiveSpan()

    const apiSurface = [
      'setAttribute',
      'setAttributes',
      'addEvent',
      'addLink',
      'addLinks',
      'setStatus',
      'updateName',
      'end',
      'isRecording',
      'recordException'
    ]
    for (const method of apiSurface) {
      t.assert.equal(typeof span[method], 'function')
    }

    end()
  })
})
