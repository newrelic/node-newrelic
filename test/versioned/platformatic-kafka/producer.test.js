/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { randomUUID } = require('node:crypto')

const promiseResolvers = require('../../lib/promise-resolvers')
const helper = require('../../lib/agent_helper')
const {
  kafka_host: kHost,
  kafka_port: kPort
} = require('../../lib/params')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      pltkafka_instrumentation: true
    }
  })
  ctx.nr.topic = `topic-${randomUUID()}`
  ctx.nr.clientId = `client-${randomUUID()}`

  const {
    Admin,
    Producer,
    stringSerializers,
    connectionsConnectsChannel
  } = require('@platformatic/kafka')
  ctx.nr.pltKafka = { Admin, Producer, stringSerializers }
  ctx.nr.producer = new Producer({
    clientId: ctx.nr.clientId,
    bootstrapBrokers: [`${kHost}:${kPort}`],
    serializers: stringSerializers
  })
  ctx.nr.connectionsConnectsChannel = connectionsConnectsChannel

  const admin = new Admin({
    clientId: 'test-admin',
    bootstrapBrokers: [`${kHost}:${kPort}`]
  })
  await admin.createTopics({
    topics: [ctx.nr.topic],
    partitions: 1,
    replicas: 1
  })
  ctx.nr.admin = admin
})

test.afterEach(async (ctx) => {
  await ctx.nr.producer.close()
  await ctx.nr.admin.deleteTopics({ topics: [ctx.nr.topic] })
  await ctx.nr.admin.close()

  helper.unloadAgent(ctx.nr.agent)
})

test('adds package tracking metrics', (t) => {
  // TODO: assert that package tracking metrics are added during module instrumentation
  t.diagnostic('test not implemented')
})

test('reports connection errors', async (t) => {
  t.plan(4)

  // For some reason, the plan is not enough. Without the resolver, the
  // asynchronous activity doesn't have time to complete.
  const { promise, resolve } = promiseResolvers()
  const expectedTxName = 'produce-tx-error'

  const { clientId } = t.nr
  const { Producer, stringSerializers } = t.nr.pltKafka
  await t.nr.producer.close()
  t.nr.producer = new Producer({
    clientId,
    bootstrapBrokers: [`${kHost}:13337`], // non-listening port to trigger connect error
    serializers: stringSerializers,
    retries: 0
  })
  const { agent, producer } = t.nr

  agent.on('transactionFinished', (tx) => {
    t.assert.equal(tx.name, expectedTxName)
    t.assert.equal(tx.exceptions.length, 1)
    const event = tx.agent.errors.eventAggregator.getEvents().at(0).at(0)
    t.assert.equal(event['error.message'], 'Connection to 127.0.0.1:13337 failed.')
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedTxName
    try {
      await producer.send({
        messages: [{
          topic: 'does not matter',
          key: 'key1',
          value: 'value1'
        }]
      })
      t.assert.fail('should generate an error')
    } catch (error) {
      t.assert.ok(error)
    } finally {
      tx.end()
      resolve()
    }
  })

  await promise
})

test('tracks messages sent from a producer', (t, end) => {
  t.plan(5)

  const { agent, producer, topic } = t.nr
  const expectedTxName = 'success-case'

  agent.on('transactionFinished', (tx) => {
    t.assert.equal(tx.name, expectedTxName)

    // TODO: I don't think it should start with "Truncated"?
    const name = `Truncated/MessageBroker/Kafka/topic/Produce/Named/${topic}`
    const segment = tx.agent.tracer.getSegment()
    const segmentChildren = tx.trace.getChildren(segment.id)

    const foundSegment = segmentChildren.find((c) => c.name.endsWith(topic))
    t.assert.ok(foundSegment)
    t.assert.equal(foundSegment.name, name)

    const metric = tx.metrics.getMetric(name)
    t.assert.equal(metric.callCount, 1)

    const trackingMetric = tx.agent.metrics.getMetric(`MessageBroker/Kafka/Nodes/${kHost}/Produce/${topic}`)
    t.assert.equal(trackingMetric.callCount, 1)

    end()
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedTxName
    try {
      await producer.send({
        messages: [{
          topic,
          key: 'user-123',
          value: JSON.stringify({ name: 'John', action: 'login' }),
          headers: { source: 'web-app' }
        }]
      })
    } catch (error) {
      t.assert.fail('should not have generated an error: ' + error.message)
    } finally {
      tx.end()
    }
  })
})
