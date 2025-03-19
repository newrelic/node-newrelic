/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const otel = require('@opentelemetry/api')
const {
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_SYSTEM,
} = require('../../../lib/otel/constants.js')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true,
    },
  })
  ctx.nr.lib = require('@google-cloud/pubsub')
  ctx.nr.api = helper.getAgentApi()
  ctx.nr.tracer = otel.trace.getTracer('pubsub-test')
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  // disable all global constructs from trace sdk
  otel.trace.disable()
  otel.context.disable()
  otel.propagation.disable()
  otel.diag.disable()
})

test('publish message', (ctx, end) => {
  const { agent, tracer } = ctx.nr

  // Create a topic, then publish a message to it
  helper.runInTransaction(agent, async (tx) => {
    tx.name = 'publish-message'
    // https://opentelemetry.io/docs/specs/semconv/messaging/gcp-pubsub/
    const attributes = {
      [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
      [ATTR_MESSAGING_DESTINATION_NAME]: 'my-topic',
    }
    tracer.startActiveSpan(tx.name, { kind: otel.SpanKind.PRODUCER, attributes }, async (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      assert.equal(segment.name, 'MessageBroker/gcp_pubsub/Unknown/Produce/Named/my-topic') // TODO: 'Unknown' will be replaced with 'topic' once we incorportate otel semconvs 1.31.0
      span.end()
      tx.end()
      assert.equal(span.attributes[ATTR_MESSAGING_SYSTEM], 'gcp_pubsub')
      assert.equal(span.attributes[ATTR_MESSAGING_DESTINATION_NAME], 'my-topic')
      end()
    })
  })
})

// TODO: subscriber test(s)
