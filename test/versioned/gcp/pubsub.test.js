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
    ATTR_MESSAGING_OPERATION_NAME,
    ATTR_MESSAGING_SYSTEM
} = require('../../../lib/otel/constants.js')

test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
        feature_flag: {
            opentelemetry_bridge: true
        }
    })

    // Assumes Google Cloud credentials are set up
    // via https://cloud.google.com/pubsub/docs/publish-receive-messages-client-library#node.js
    const lib = require('@google-cloud/pubsub')
    const PubSub = lib.PubSub
    ctx.nr.publisher = new PubSub({ enableOpenTelemetryTracing: true })
    ctx.nr.subscriber = new PubSub({ enableOpenTelemetryTracing: true })

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

test('publish message and then pull', (ctx, end) => {
    const { agent, lib, publisher, subscriber, tracer } = ctx.nr

    // Create a topic, then publish a message to it
    const topicName = 'my-topic'
    const topic = publisher.topic(topicName)
    helper.runInTransaction(agent, async (tx) => {
        tx.name = 'publish-message'
        // https://opentelemetry.io/docs/specs/semconv/messaging/gcp-pubsub/
        const attributes = {
            [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
            [ATTR_MESSAGING_OPERATION_NAME]: 'send',
            [ATTR_MESSAGING_DESTINATION_NAME]: topicName,
        }
        tracer.startActiveSpan(tx.name, { kind: otel.SpanKind.PRODUCER, attributes }, async (span) => {
            await topic.publishMessage({ data: Buffer.from('Hello, world!') })
            const segment = agent.tracer.getSegment()
            assert.equal(tx.traceId, span.spanContext().traceId)
            assert.equal(segment.name, 'MessageBroker/gcp_pubsub/Unknown/Produce/Named/Unknown') //TODO: should this be unknown?
            span.end()
            tx.end()
            assert.equal(span.attributes['messaging.system'], 'gcp_pubsub')
            assert.equal(span.attributes['messaging.destination.name'], topicName)
        })
    })

    // Pull the message from the subscription
    const subscriptionName = 'my-sub'
    const subscription = subscriber.subscription(subscriptionName)
    helper.runInTransaction(agent, async (tx) => {
        tx.name = 'pull-message'
        // https://opentelemetry.io/docs/specs/semconv/messaging/gcp-pubsub/
        const attributes = {
            [ATTR_MESSAGING_SYSTEM]: 'gcp_pubsub',
            [ATTR_MESSAGING_OPERATION_NAME]: 'receive',
            [ATTR_MESSAGING_DESTINATION_NAME]: topicName,
        }
        tracer.startActiveSpan(tx.name, { kind: otel.SpanKind.CONSUMER, attributes }, async (span) => {
            const messageHandler = message => {
                message.ack()
                subscription.removeListener('message', messageHandler)
                span.end()
                tx.end()
                assert.equal(span.attributes['messaging.system'], 'gcp_pubsub')
                assert.equal(span.attributes['messaging.destination.name'], topicName)
                end()
            }
            subscription.on('message', messageHandler)
        })
    })
})
