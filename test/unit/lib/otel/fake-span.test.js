/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const FakeSpan = require('#agentlib/otel/fake-span.js')

test('should create a fake span from segment and transaction', (t) => {
  const agent = helper.loadMockedAgent()
  t.after(() => {
    helper.unloadAgent(agent)
  })

  const segment = { id: 'id' }
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)
  const spanCtx = span.spanContext()
  assert.deepEqual(spanCtx, {
    spanId: 'id',
    traceId: 'traceId',
    traceFlags: 1
  })
})
