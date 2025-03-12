/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')

test('GCP PubSub API', async (t) => {
    t.beforeEach(async (ctx) => {
        ctx.nr = {}
        ctx.nr.agent = helper.instrumentMockedAgent()
        const { PubSub } = require('@google-cloud/pubsub')
        ctx.nr.pubsub = new PubSub({
            projectId: 'fake-project-id',
            credentials: {
                client_email: 'fake-email@fake-project-id.iam.gserviceaccount.com',
                private_key: 'test-private-key'
            },
            // https://cloud.google.com/iam/docs/full-resource-names
            apiEndpoint: 'https://custom-endpoint.pubsub.googleapis.com/fake-project-id'
        })
    })

    t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('publish message', async (ctx) => {
        const { agent, pubsub } = ctx.nr
        helper.runInTransaction(agent, async (tx) => {
            const topic = pubsub.topic('my-topic')
            const message = Buffer.from('Hello, world!')
            const messageId = await topic.publish(message)
            tx.end()
            assert.ok(messageId)
        })
    })

    await t.test('pull messages', async (ctx) => {
        const { agent, pubsub } = ctx.nr
        helper.runInTransaction(agent, async (tx) => {
            const subscription = pubsub.subscription('my-subscription')
            const [messages] = await subscription.pull()
            assert.ok(messages)
            messages.forEach(message => {
                message.ack()
            })
            tx.end()
        })
    })
})