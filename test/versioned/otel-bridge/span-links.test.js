/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const helper = require('../../lib/agent_helper')
const promiseResolvers = require('../../lib/promise-resolvers')
const params = require('../../lib/params')
const { DESTINATIONS } = require('../../../lib/transaction')

const CON_STRING = 'amqp://' + params.rabbitmq_host + ':' + params.rabbitmq_port

test('span links are propagated to new relic', async (t) => {
  t.plan(13, { wait: 5_000 })

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
    opentelemetry: {
      enabled: true,
      traces: { enabled: true }
    }
  })
  agent.config.entity_guid = 'guid-123456'
  agent.config.license_key = 'license-123456'

  const { registerInstrumentations } = require('@opentelemetry/instrumentation')
  const { AmqplibInstrumentation } = require('@opentelemetry/instrumentation-amqplib')
  registerInstrumentations([
    new AmqplibInstrumentation({
      useLinksForConsume: true,
      consumeHook (span) {
        span.addLink({
          context: span.spanContext(),
          attributes: {
            test: 'test'
          }
        })
      }
    })
  ])

  const amqplib = require('amqplib')
  const queue = 'testQueue'
  const consumedMessages = []

  let produceTx
  let produceSegment
  let produceSpan
  agent.on('transactionFinished', async (tx) => {
    const segment = tx.trace.root
    const segmentChildren = tx.trace.getChildren(segment.id)

    let foundSegment = segmentChildren.find((c) => c.name.endsWith('Produce/Named/unknown'))
    if (foundSegment) {
      produceTx = tx
      produceSegment = foundSegment
      produceSpan = tx.agent.spanEventAggregator.getEvents().find(
        (s) => s.intrinsics.name.includes('Produce/Named/unknown')
      )
      t.assert.ok(produceSpan)
      return
    }

    foundSegment = segmentChildren.find((c) => c.name.startsWith('OtherTransaction/Message'))
    t.assert.ok(foundSegment)
    // OTEL will set the queue name (messaging.destination.name) to an empty
    // string. So we'll get "unknown" via our rules mapping.
    t.assert.equal(foundSegment.name, 'OtherTransaction/Message/rabbitmq/topic/Named/unknown')
    t.assert.equal(
      foundSegment.spanLinks.length,
      2,
      'should have auto added and manually added (through hook) links'
    )

    let link = foundSegment.spanLinks[0]
    t.assert.equal(link.intrinsics.type, 'SpanLink')
    t.assert.equal(
      (produceSpan.intrinsics.timestamp - link.intrinsics.timestamp) <= 10,
      true,
      'timestamp should be within expected window'
    )
    t.assert.equal(
      link.intrinsics.id,
      foundSegment.id,
      'intrinsics.id should match consumer span id'
    )
    t.assert.equal(
      link.intrinsics['trace.id'],
      tx.traceId,
      'trace.id should match consumer transaction id'
    )
    t.assert.equal(
      link.intrinsics.linkedSpanId,
      produceSegment.getSpanId(),
      'linkedSpanId should match producer span id'
    )
    t.assert.equal(
      link.intrinsics.linkedTraceId,
      produceTx.traceId,
      'linkedTraceId should match producer transaction id'
    )

    link = foundSegment.spanLinks[1]
    t.assert.equal(link.intrinsics.type, 'SpanLink')
    t.assert.deepEqual(
      link.userAttributes.get(DESTINATIONS.TRANS_SEGMENT),
      { test: 'test' }
    )

    t.assert.equal(consumedMessages.length, 1)

    resolve()
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
  await helper.runInTransaction(agent, async (tx) => {
    await postMessage()
    tx.end()
  })
  await consumeMessage()

  await promise

  async function postMessage() {
    const conn = await amqplib.connect(CON_STRING)
    const produceChannel = await conn.createConfirmChannel()
    await produceChannel.assertQueue(queue)
    try {
      await new Promise((resolve, reject) => {
        produceChannel.sendToQueue(queue, Buffer.from('hello world'), {}, (error) => {
          if (error) return reject(error)
          resolve()
        })
      })
    } catch (error) {
      t.assert.ifError(error)
    } finally {
      await produceChannel.close()
      await conn.close()
    }
  }

  async function consumeMessage() {
    const conn = await amqplib.connect(CON_STRING)
    const consumeChannel = await conn.createChannel()
    await consumeChannel.assertQueue(queue)
    try {
      await new Promise((resolve) => {
        consumeChannel.consume(queue, (msg) => {
          consumedMessages.push(msg)
          consumeChannel.ack(msg)
          resolve()
        })
      })
    } catch (error) {
      t.assert.ifError(error)
    } finally {
      await consumeChannel.close()
      await conn.close()
    }
  }
})
