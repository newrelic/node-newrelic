/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const { assertPackageMetrics, assertSegments, assertSpanKind, match } = require('../../lib/custom-assertions')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')
const utils = require('./utils')

const SEGMENT_PREFIX = 'kafkajs.Kafka.consumer#'
const broker = `${params.kafka_host}:${params.kafka_port}`

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      kafkajs_instrumentation: true
    }
  })

  const { Kafka, logLevel } = require('kafkajs')
  ctx.nr.Kafka = Kafka
  const topic = helper.randomString('topic')
  ctx.nr.topic = topic
  const clientId = helper.randomString('kafka-test')
  ctx.nr.clientId = clientId

  const kafka = new Kafka({
    clientId,
    brokers: [broker],
    logLevel: logLevel.NOTHING
  })
  await utils.createTopic({ topic, kafka })

  const producer = kafka.producer()
  await producer.connect()
  ctx.nr.producer = producer
  const consumer = kafka.consumer({ groupId: 'kafka' })
  await consumer.connect()
  ctx.nr.consumer = consumer
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['kafkajs'])
  await ctx.nr.consumer.disconnect()
  await ctx.nr.producer.disconnect()
})

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('kafkajs/package.json')
  assertPackageMetrics({ agent, pkg: 'kafkajs', version })
})

test('send records correctly', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent, consumer, producer, topic } = t.nr
  const message = 'test message'
  const expectedName = 'produce-tx'

  agent.on('transactionFinished', (tx) => {
    if (tx.name === expectedName) {
      const name = `MessageBroker/Kafka/Topic/Produce/Named/${topic}`
      const segment = tx.agent.tracer.getSegment()
      const children = tx.trace.getChildren(segment.id)

      const foundSegment = children.find((s) => s.name.endsWith(topic))
      plan.equal(foundSegment.name, name)

      const metric = tx.metrics.getMetric(name)
      plan.equal(metric.callCount, 1)
      const sendMetric = agent.metrics.getMetric(
        'Supportability/Features/Instrumentation/kafkajs/send'
      )
      plan.equal(sendMetric.callCount, 1)

      const produceTrackingMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Produce/${topic}`
      )
      plan.equal(produceTrackingMetric.callCount, 1)
      assertSpanKind({ agent, segments: [{ name, kind: 'producer' }], assert: plan })
    }
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          plan.equal(actualMessage.value.toString(), message)
          plan.equal(actualMessage.headers['x-foo'].toString(), 'foo')
          plan.equal(actualMessage.headers.traceparent.toString().startsWith('00-'), true)
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.send({
      acks: 1,
      topic,
      messages: [
        {
          key: 'key',
          value: message,
          headers: {
            'x-foo': 'foo'
          }
        }
      ]
    })
    await promise

    tx.end()
  })

  await plan.completed
})

test('send passes along DT headers', async (t) => {
  const plan = tspl(t, { plan: 13 })
  const { agent, consumer, producer, topic } = t.nr
  const expectedName = 'produce-tx'

  // These agent.config lines are utilized to simulate the inbound
  // distributed trace that we are trying to validate.
  agent.config.account_id = 'account_1'
  agent.config.primary_application_id = 'app_1'
  agent.config.trusted_account_key = 42
  let produceTx = null
  const consumeTxs = []
  let txCount = 0

  agent.on('transactionFinished', (tx) => {
    txCount++

    if (tx.name === expectedName) {
      produceTx = tx
    } else {
      consumeTxs.push(tx)
    }

    if (txCount === 3) {
      utils.verifyDistributedTrace({ plan, consumeTxs, produceTx })
    }
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topic, fromBeginning: true })

    const promise = new Promise((resolve) => {
      let msgCount = 0
      consumer.run({
        eachMessage: async () => {
          ++msgCount
          if (msgCount === 2) {
            resolve()
          }
        }
      })
    })

    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.send({
      acks: 1,
      topic,
      messages: [
        { key: 'key', value: 'one' },
        { key: 'key2', value: 'two' }
      ]
    })

    await promise

    tx.end()
  })

  await plan.completed
})

test('sendBatch records correctly', async (t) => {
  const plan = tspl(t, { plan: 9 })
  const { agent, consumer, producer, topic } = t.nr
  const message = 'test message'
  const expectedName = 'produce-tx'

  agent.on('transactionFinished', (tx) => {
    if (tx.name === expectedName) {
      const name = `MessageBroker/Kafka/Topic/Produce/Named/${topic}`
      const segment = tx.agent.tracer.getSegment()
      const children = tx.trace.getChildren(segment.id)

      const foundSegment = children.find((s) => s.name.endsWith(topic))
      plan.equal(foundSegment.name, name)

      const metric = tx.metrics.getMetric(name)
      plan.equal(metric.callCount, 1)

      plan.equal(tx.isDistributedTrace, true)
      const sendMetric = agent.metrics.getMetric(
        'Supportability/Features/Instrumentation/kafkajs/sendBatch'
      )
      plan.equal(sendMetric.callCount, 1)

      const produceTrackingMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Produce/${topic}`
      )
      plan.equal(produceTrackingMetric.callCount, 1)
      assertSpanKind({ agent, segments: [{ name, kind: 'producer' }], assert: plan })
    }
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          plan.equal(actualMessage.value.toString(), message)
          match(actualMessage.headers['x-foo'].toString(), 'foo', { assert: plan })
          plan.equal(actualMessage.headers.traceparent.toString().startsWith('00-'), true)
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.sendBatch({
      acks: 1,
      topicMessages: [
        {
          topic,
          messages: [
            {
              key: 'key',
              value: message,
              headers: { 'x-foo': 'foo' }
            }
          ]
        }
      ]
    })
    await promise

    tx.end()
  })

  await plan.completed
})

test('consume outside of a transaction', async (t) => {
  const plan = tspl(t, { plan: 17 })
  const { agent, consumer, producer, topic, clientId } = t.nr
  const message = 'test message'

  const txPromise = new Promise((resolve) => {
    agent.on('transactionFinished', (tx) => {
      utils.verifyConsumeTransaction({ plan, tx, topic, clientId })
      const sendMetric = agent.metrics.getMetric(
        'Supportability/Features/Instrumentation/kafkajs/eachMessage'
      )
      plan.equal(sendMetric.callCount, 1)

      const consumeTrackingMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Consume/${topic}`
      )
      plan.equal(consumeTrackingMetric.callCount, 1)

      resolve()
    })
  })

  await consumer.subscribe({ topics: [topic], fromBeginning: true })
  const testPromise = new Promise((resolve) => {
    consumer.run({
      eachMessage: async ({ message: actualMessage }) => {
        plan.equal(actualMessage.value.toString(), message)
        resolve()
      }
    })
  })
  await utils.waitForConsumersToJoinGroup({ consumer })
  await producer.send({
    acks: 1,
    topic,
    messages: [{ key: 'key', value: message }]
  })

  await Promise.all([txPromise, testPromise])
  await plan.completed
})

test('consume inside of a transaction', async (t) => {
  const plan = tspl(t, { plan: 49 })
  const { agent, consumer, producer, topic, clientId } = t.nr
  const expectedName = 'testing-tx-consume'

  const messages = ['one', 'two', 'three']
  let txCount = 0
  let msgCount = 0

  const txPromise = new Promise((resolve) => {
    agent.on('transactionFinished', (tx) => {
      txCount++
      if (tx.name === expectedName) {
        assertSegments(
          tx.trace,
          tx.trace.root,
          [`${SEGMENT_PREFIX}subscribe`, `${SEGMENT_PREFIX}run`],
          {
            exact: false
          },
          { assert: plan }
        )
      } else {
        utils.verifyConsumeTransaction({ plan, tx, topic, clientId })
      }

      if (txCount === messages.length + 1) {
        assertSpanKind({
          agent,
          segments: [
            { name: `${SEGMENT_PREFIX}subscribe`, kind: 'internal' },
            { name: `${SEGMENT_PREFIX}run`, kind: 'internal' },
          ],
          assert: plan
        })
        resolve()
      }
    })
  })

  await helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topics: [topic], fromBeginning: true })
    const testPromise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          msgCount++
          plan.ok(messages.includes(actualMessage.value.toString()))
          if (msgCount === messages.length) {
            resolve()
          }
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    const messagePayload = messages.map((m, i) => { return { key: `key-${i}`, value: m } })
    await producer.send({
      acks: 1,
      topic,
      messages: messagePayload
    })

    tx.end()
    return Promise.all([txPromise, testPromise])
  })

  await plan.completed
})

test('consume batch inside of a transaction', async (t) => {
  const plan = tspl(t, { plan: 12 })
  const { agent, consumer, producer, topic } = t.nr
  const expectedName = 'testing-tx-consume'

  const messages = ['one', 'two', 'three', 'four', 'five']

  const txPromise = new Promise((resolve) => {
    agent.on('transactionFinished', (tx) => {
      assertSegments(
        tx.trace,
        tx.trace.root,
        [`${SEGMENT_PREFIX}subscribe`, `${SEGMENT_PREFIX}run`],
        { exact: false },
        { assert: plan }
      )
      assertSpanKind({
        agent,
        segments: [
          { name: `${SEGMENT_PREFIX}subscribe`, kind: 'internal' },
          { name: `${SEGMENT_PREFIX}run`, kind: 'internal' },
        ],
        assert: plan
      })
      resolve()
    })
  })

  await helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topics: [topic], fromBeginning: true })
    const testPromise = new Promise((resolve) => {
      consumer.run({
        eachBatch: async ({ batch }) => {
          plan.equal(
            batch.messages.length,
            messages.length,
            `should have ${messages.length} messages in batch`
          )
          batch.messages.forEach((m) => {
            plan.ok(messages.includes(m.value.toString()), 'should have message')
          })
          const sendMetric = agent.metrics.getMetric(
            'Supportability/Features/Instrumentation/kafkajs/eachBatch'
          )
          plan.equal(sendMetric.callCount, 1)

          const consumeTrackingMetric = agent.metrics.getMetric(
            `MessageBroker/Kafka/Nodes/${broker}/Consume/${topic}`
          )
          plan.equal(consumeTrackingMetric.callCount, 1)

          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    const messagePayload = messages.map((m, i) => { return { key: `key-${i}`, value: m } })
    await producer.send({
      acks: 1,
      topic,
      messages: messagePayload
    })

    tx.end()
    return Promise.all([txPromise, testPromise])
  })

  await plan.completed
})
