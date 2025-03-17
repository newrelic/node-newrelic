/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const {
    DESTINATIONS: { TRANS_SEGMENT }
} = require('../../../lib/config/attribute-filter')
const { match } = require('../../lib/custom-assertions')
const otel = require('@opentelemetry/api')
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')
const { detectResourcesSync } = require('@opentelemetry/resources');
const { gcpDetector } = require('@opentelemetry/resource-detector-gcp')

test.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent({
        feature_flag: {
            opentelemetry_bridge: true
        }
    })
    const lib = require('@google-cloud/pubsub')
    ctx.nr.lib = lib

    // Assumes Google Cloud credentials are set up
    // via https://cloud.google.com/pubsub/docs/publish-receive-messages-client-library#node.js
    ctx.nr.publisher = new lib.PubSub()
    ctx.nr.subscriber = new lib.PubSub()

    // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/detectors/node/opentelemetry-resource-detector-gcp/README.md
    // TODO: try to get otel spans to work with gcp
    const resource = detectResourcesSync({
        detectors: [gcpDetector],
    })
    const tracerProvider = new NodeTracerProvider({ resource });
    ctx.nr.tracer = tracerProvider.getTracer('default')
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
    const topicName = 'my-topic'
    const data = 'Hello, world!'
    helper.runInTransaction(agent, async (tx) => {
        tx.name = 'publish-message'
        // https://github.com/open-telemetry/opentelemetry-js-contrib/blob/8e087550ad990732e51c1a2aeae7ba8abe7ecbe6/detectors/node/opentelemetry-resource-detector-gcp/src/detectors/GcpDetector.ts#L75
        // const otel = lib.openTelemetry // TODO: do I use this otel?
        tracer.startActiveSpan('publish message', { kind: otel.SpanKind.PRODUCER }, async (span) => {
            const topic = publisher.topic(topicName)
            assert.ok(topic)
            const messageId = await topic.publishMessage({ data: Buffer.from(data) })
            assert.ok(messageId)
            const segment = agent.tracer.getSegment()
            span.end()
            tx.end()
            finish(tx)
            end()
        })
    })

    // const subscriptionName = 'my-sub'
    // await helper.runInTransaction(agent, async (tx) => {
    //     const subscription = subscriber.subscription(subscriptionName)
    //     assert.ok(subscription)
    //     const messageHandler = message => {
    //         message.ack()
    //     }
    //     subscription.on('message', messageHandler)
    //     setTimeout(() => {
    //         subscription.removeListener('message', messageHandler)
    //         tx.end()
    //         console.log(tx.trace.root)
    //         finish({ transaction: tx })
    //     }, 1000)
    // })
})

function finish(transaction) {
    const expectedSegmentCount = 2
    const root = transaction.trace.root
    const segments = checkGCPAttributes({
        trace: transaction.trace,
        segment: root,
        pattern: /.*/ // TODO: replace with proper pattern
    })
}

function checkGCPAttributes({ trace, segment, pattern, markedSegments = [] }) {
    const expectedAttrs = {
        'messaging.system': String,
        'cloud.region': String,
        'cloud.account.id': String,
        'messaging.destination.name': String
    }

    if (pattern.test(segment.name)) {
        markedSegments.push(segment)
        const attrs = segment.attributes.get(TRANS_SEGMENT)
        match(attrs, expectedAttrs)
    }
    const children = trace.getChildren(segment.id)
    children.forEach((child) => {
        checkGCPAttributes({ trace, segment: child, pattern, markedSegments })
    })

    return markedSegments
}
