/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const {
    DESTINATIONS: { TRANS_SEGMENT }
} = require('../../../lib/config/attribute-filter')
const { match } = require('../../lib/custom-assertions')

test('GCP PubSub API', async (t) => {
    t.beforeEach(async (ctx) => {
        ctx.nr = {}
        ctx.nr.agent = helper.instrumentMockedAgent()
        const Shim = require('../../../lib/shim/message-shim')
        ctx.nr.setLibrarySpy = sinon.spy(Shim.prototype, 'setLibrary')
        const lib = require('@google-cloud/pubsub')
        const PubSub = lib.PubSub
        ctx.nr.lib = lib

        // Assumes Google Cloud credentials are set up
        // via https://cloud.google.com/pubsub/docs/publish-receive-messages-client-library#node.js
        ctx.nr.publisher = new PubSub()
        ctx.nr.subscriber = new PubSub()
    })

    t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
        ctx.nr.setLibrarySpy.restore()
    })

    await t.test('publish message', async (ctx) => {
        const { agent, publisher, setLibrarySpy } = ctx.nr
        const topicName = 'my-topic'
        const data = 'Hello, world!'
        await helper.runInTransaction(agent, async (tx) => {
            const topic = publisher.topic(topicName)
            assert.ok(topic)
            const dataBuffer = Buffer.from(data)
            const messageId = await topic.publishMessage({ data: dataBuffer })
            assert.ok(messageId)
            tx.end()
            finish({ transaction: tx, setLibrarySpy: setLibrarySpy })
        })
    })

    await t.test('pull messages', async (ctx) => {
        const { agent, subscriber, setLibrarySpy } = ctx.nr
        const subscriptionName = 'my-sub'
        await helper.runInTransaction(agent, async (tx) => {
            const subscription = subscriber.subscription(subscriptionName)
            assert.ok(subscription)
            const messaageHandler = message => {
                message.ack()
            }
            subscription.on('message', messaageHandler)
            setTimeout(() => {
                subscription.removeListener('message', messaageHandler)
                tx.end()
                finish({ transaction: tx, setLibrarySpy: setLibrarySpy })
            })
        })
    })
})

function finish({ transaction, setLibrarySpy }) {
    const expectedSegmentCount = 2
    const root = transaction.trace.root
    const segments = checkGCPAttributes({
        trace: transaction.trace,
        segment: root,
        pattern: /.*/ // TODO: replace with proper pattern
    })

    assert.equal(
        segments.length,
        expectedSegmentCount,
        `should have ${expectedSegmentCount} GCP PubSub segments`
    )
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
