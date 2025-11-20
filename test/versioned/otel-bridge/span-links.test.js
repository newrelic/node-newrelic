/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const helper = require('../../lib/agent_helper')
const promiseResolvers = require('../../lib/promise-resolvers')
const params = require('../../lib/params')

const CON_STRING = 'amqp://' + params.rabbitmq_host + ':' + params.rabbitmq_port

test('span links are propagated to new relic', async (t) => {
  t.plan(11, { wait: 5_000 })

  // Under Node.js v20, the `t.plan` will not wait for the assertions
  // correctly. We need to await this promise in order for the test to have
  // time to work under that release.
  // TODO: remove once Node.js 22 is the baseline
  const { promise, resolve } = promiseResolvers()

  const agent = helper.instrumentMockedAgent({
    instrumentation: {
      amqplib: {
        enabled: false
      }
    },
    opentelemetry_bridge: {
      enabled: true,
      traces: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib')
  registerInstrumentations([
    new AmqplibInstrumentation({ useLinksForConsume: true })
  ])

  const amqplib = require('amqplib')
  const queue = 'testQueue'
  const consumedMessages = []

  let produceTx
  let produceSegment
  agent.on('transactionFinished', async (tx) => {
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)

    let foundSegment = segmentChildren.find((c) => c.name.endsWith('Produce/Named/unknown'))
    if (foundSegment) {
      produceTx = tx
      produceSegment = foundSegment
      return
    }

    const originalSpans = produceTx.agent.spanEventAggregator.getEvents()
    const originalSpan = originalSpans.find((s) => s.attributes.type === 'SpanLink')
    t.assert.ok(originalSpan)

    foundSegment = segmentChildren.find((c) => c.name.startsWith('OtherTransaction/Message'))
    t.assert.ok(foundSegment)
    // OTEL will set the queue name (messaging.destination.name) to an empty
    // string. So we'll get "unknown" via our rules mapping.
    t.assert.equal(foundSegment.name, 'OtherTransaction/Message/rabbitmq/topic/Named/unknown')

    const attrs = foundSegment.attributes.attributes
    t.assert.ok(attrs)
    t.assert.equal(attrs.type.value, 'SpanLink')
    t.assert.equal(attrs.timestamp.value, originalSpan.attributes.timestamp)
    t.assert.equal(attrs.id.value, originalSpan.attributes.id)
    t.assert.equal(attrs['trace.id'].value, originalSpan.attributes['trace.id'])
    t.assert.equal(attrs.linkedSpanId.value, produceSegment.getSpanId())
    t.assert.equal(attrs.linkedTraceId.value, produceTx.traceId)

    t.assert.equal(consumedMessages.length, 1)

    resolve()
  })

  const conn = await amqplib.connect(CON_STRING)
  const produceChannel = await conn.createConfirmChannel()
  const consumeChannel = await conn.createChannel()
  await consumeChannel.assertQueue(queue)

  t.after(async () => {
    await produceChannel.close()
    await consumeChannel.close()
    await conn.close()
  })

  // The structure of this is important:
  // 1. We first want to put a message in the queue. This action must be
  // performed in a background transaction, because a producer is typically
  // contained within an existing transaction (e.g. as part of a web request).
  // 2. Once the message is put on the queue, we need to pop it. Consumer
  // actions start a new transaction, as they are expected to be independent
  // actions that occur outside of a typical workflow (e.g. _not_ part of
  // a web request). While `amqplib.consume` is a callback registration
  // operation, i.e. the passed handler is registered with the module and will
  // be invoked for every received message until it is unregistered, we do not
  // want to register it prior to the message being on the queue. If we did,
  // we wouldn't be able to guarantee the transaction processing order in the
  // `transactionFinished` handler.
  helper.runInTransaction(agent, async (tx) => {
    // Send a message to the queue and wait for it to be ready for consumption.
    await new Promise((resolve, reject) => {
      produceChannel.sendToQueue(queue, Buffer.from('hello world'), {}, (error) => {
        if (error) return reject(error)

        // We can't use `consumeChannel.get` because the instrumentation does not
        // patch that method, and hence does not generate consumer spans for it.
        consumeChannel.consume(queue, (msg) => {
          consumedMessages.push(msg)
          consumeChannel.ack(msg)
        })

        resolve()
      })
    })

    tx.end()
  })

  await promise
})
