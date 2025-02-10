/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Tests to verify that we can map OTEL "consumer" spans to NR segments.

const test = require('node:test')
const assert = require('node:assert')

const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { SpanKind } = require('@opentelemetry/api')
const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_SYSTEM,
} = require('#agentlib/otel/constants.js')

const { DESTINATIONS } = require('../../../../lib/transaction')
const helper = require('../../../lib/agent_helper')
const createSpan = require('./fixtures/span')
const SegmentSynthesizer = require('../../../../lib/otel/segment-synthesis')

test.beforeEach((ctx) => {
  const logs = []
  const logger = {
    debug(...args) {
      logs.push(args)
    }
  }
  const agent = helper.loadMockedAgent()
  const synth = new SegmentSynthesizer(agent, { logger })
  const tracer = new BasicTracerProvider().getTracer('default')

  ctx.nr = {
    agent,
    logger,
    logs,
    synth,
    tracer
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create consumer segment from otel span', (t) => {
  const { synth, tracer } = t.nr
  const span = createSpan({ tracer, kind: SpanKind.CONSUMER })
  span.setAttribute('messaging.operation', 'receive')
  span.setAttribute(ATTR_MESSAGING_SYSTEM, 'msgqueuer')
  span.setAttribute(ATTR_MESSAGING_DESTINATION, 'dest1')
  span.setAttribute(ATTR_MESSAGING_DESTINATION_KIND, 'topic1')

  const expectedName = 'OtherTransaction/Message/msgqueuer/topic1/Named/dest1'
  const { segment, transaction } = synth.synthesize(span)
  assert.equal(segment.name, expectedName)
  assert.equal(segment.parentId, segment.root.id)
  assert.equal(transaction.name, expectedName)
  assert.equal(transaction.type, 'bg')
  assert.equal(transaction.baseSegment, segment)
  assert.equal(
    transaction.trace.attributes.get(DESTINATIONS.TRANS_SCOPE)['message.queueName'],
    'dest1'
  )

  transaction.end()
})
