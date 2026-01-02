/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const SpanLink = require('#agentlib/spans/span-link.js')
const { match } = require('#test/assert')

test('requires link data', (t) => {
  t.plan(2)

  const logger = {
    error(msg) {
      t.assert.equal(msg, 'cannot create span link without required link data')
    }
  }

  const link = new SpanLink({}, { logger })
  t.assert.ok(link)
})

test('requires span context', (t) => {
  t.plan(2)

  const logger = {
    error(msg) {
      t.assert.equal(msg, 'cannot create span link without required span context')
    }
  }

  const otelLink = {}
  const link = new SpanLink({ link: otelLink }, { logger })
  t.assert.ok(link)
})

test('builds correct instance', (t) => {
  const otelLink = {
    context: {
      spanId: 'upstream-span-id',
      traceId: 'upstream-trace-id'
    },
    attributes: {
      testAttr1: 'ok1',
      testAttr2: 'ok2',
      testAttr3: null
    }
  }
  const spanContext = {
    spanId: 'local-span-id',
    traceId: 'local-trace-id'
  }
  const link = new SpanLink({ link: otelLink, spanContext, timestamp: 123 })

  const expectedIntrinsics = {
    type: 'SpanLink',
    id: spanContext.spanId,
    timestamp: 123,
    'trace.id': spanContext.traceId,
    linkedSpanId: otelLink.context.spanId,
    linkedTraceId: otelLink.context.traceId
  }

  assert.ok(link)
  assert.equal(link.toString(), '[object SpanLink]')
  match(link.getIntrinsicAttributes(), expectedIntrinsics)
  match(link.toJSON(), [
    expectedIntrinsics,
    { testAttr1: 'ok1', testAttr2: 'ok2' },
    {}
  ])
})
