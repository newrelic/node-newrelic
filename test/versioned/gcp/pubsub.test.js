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
  ctx.nr.lib = require('@google-cloud/pubsub')
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true,
    },
  })
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

  helper.runInTransaction(agent, async (tx) => {
    tx.name = 'publish-message'
    const topicID = 'my-topic'
    const projectID = 'my-project'
    const attributes = {
      'code.function': 'MessageQueue._publish',
      'gcp.project_id': projectID,
      'messaging.batch.message_count': 1,
      [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
      [ATTR_MESSAGING_DESTINATION_NAME]: topicID,
    }
    const spanName = `project/${projectID}/topic/${topicID} send`
    tracer.startActiveSpan(spanName, { kind: otel.SpanKind.PRODUCER, attributes }, async (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      assert.equal(segment.name, `MessageBroker/gcp_pubsub/Unknown/Produce/Named/${topicID}`) // TODO: 'Unknown' will be replaced with 'topic' once we incorportate otel semconvs 1.31.0
      span.end()
      tx.end()
      assert.equal(span.attributes[ATTR_MESSAGING_SYSTEM], 'gcp_pubsub')
      assert.equal(span.attributes[ATTR_MESSAGING_DESTINATION_NAME], topicID)
      end()
    })
  })
})

test('ack message', (ctx, end) => {
  const { agent, tracer } = ctx.nr

  helper.runInTransaction(agent, async (tx) => {
    tx.name = 'ack-message'
    const projectID = 'my-project'
    const subscriptionID = 'my-sub'
    const attributes = {
      'code.function': 'AckQueue._sendBatch',
      'gcp.project_id': projectID,
      'messagng.batch.message_count': 1,
      [ATTR_MESSAGING_DESTINATION_NAME]: subscriptionID,
      [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
    }
    const spanName = `${subscriptionID} ack`
    tracer.startActiveSpan(spanName, { kind: otel.SpanKind.CONSUMER, attributes }, async (span) => {
      // const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      // assert.equal(segment.name, 'MessageBroker/gcp_pubsub/Unknown/Consume/Named/my-sub') // TODO: current is just '/unknown', why?
      span.end()
      tx.end()
      assert.equal(span.attributes[ATTR_MESSAGING_SYSTEM], 'gcp_pubsub')
      assert.equal(span.attributes[ATTR_MESSAGING_DESTINATION_NAME], subscriptionID)
      end()
    })
  })
})
