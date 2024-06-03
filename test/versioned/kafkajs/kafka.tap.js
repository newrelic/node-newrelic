/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const { removeModules } = require('../../lib/cache-buster')
const utils = require('./utils')

const broker = `${params.kafka_host}:${params.kafka_port}`

tap.beforeEach(async (t) => {
  t.context.agent = helper.instrumentMockedAgent()

  const { Kafka, logLevel } = require('kafkajs')
  t.context.Kafka = Kafka
  const topic = utils.randomTopic()
  t.context.topic = topic

  const kafka = new Kafka({
    clientId: 'kafka-test',
    brokers: [broker],
    logLevel: logLevel.NOTHING
  })
  await utils.createTopic({ topic, kafka })

  const producer = kafka.producer()
  await producer.connect()
  t.context.producer = producer
  const consumer = kafka.consumer({ groupId: 'kafka' })
  await consumer.connect()
  t.context.consumer = consumer
})

tap.afterEach(async (t) => {
  helper.unloadAgent(t.context.agent)
  removeModules(['kafkajs'])
  await t.context.consumer.disconnect()
  await t.context.producer.disconnect()
})

tap.test('send records correctly', (t) => {
  t.plan(4)

  const { agent, consumer, producer, topic } = t.context
  const message = 'test message'

  agent.on('transactionFinished', (tx) => {
    const name = `MessageBroker/Kafka/Topic/Produce/Named/${topic}`
    const segment = tx.agent.tracer.getSegment()

    const foundSegment = segment.children.find((s) => s.name.endsWith(topic))
    t.equal(foundSegment.name, name)

    const metric = tx.metrics.getMetric(name)
    t.equal(metric.callCount, 1)

    t.end()
  })

  helper.runInTransaction(agent, async (tx) => {
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          t.equal(actualMessage.value.toString(), message)
          t.match(actualMessage.headers['x-foo'].toString(), 'foo')
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
})

tap.test('send passes along DT headers', (t) => {
  t.plan(10)

  const now = Date.now
  Date.now = () => 1717426365982
  t.teardown(() => {
    Date.now = now
  })

  const { agent, consumer, producer, topic } = t.context
  const messages = ['one', 'two', 'three']
  const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
  const tracestate = '42@nr=0-0-account_1-app_1-span_1-txn_1-0-0.123000-' + Date.now()

  agent.config.account_id = 'account_1'
  agent.config.primary_application_id = 'app_1'
  agent.config.trusted_account_key = 42

  agent.on('transactionFinished', (tx) => {
    const headers = {}
    tx.traceContext.addTraceContextHeaders(headers)
    t.match(headers, {
      traceparent: /00-4bf92f3577b34da6a3ce929d0e0e4736-[a-z0-9]{16}-00/,
      tracestate: /42@nr=0-0-account_1-app_1-[a-z0-9]{16}-[a-z0-9]{16}-0-0.123000-1717426365982/
    })

    t.equal(tx.isDistributedTrace, true)
    t.equal(tx.parentAcct, 'account_1')
    t.equal(tx.parentApp, 'app_1')
    t.equal(tx.parentId, 'txn_1')
    t.equal(tx.parentSpanId, '00f067aa0ba902b7')
    t.equal(tx.parentType, 'App')

    t.end()
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.acceptTraceContextPayload(traceparent, tracestate)

    await consumer.subscribe({ topic, fromBeginning: true })

    let msgCount = 0
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          t.equal(messages.includes(actualMessage.value.toString()), true)
          msgCount += 1
          if (msgCount === 3) {
            resolve()
          }
        }
      })
    })

    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.send({
      acks: 1,
      topic,
      messages: messages.map((m) => {
        return { key: 'key', value: m }
      })
    })

    await promise

    tx.end()
  })
})

tap.test('sendBatch records correctly', (t) => {
  t.plan(4)

  const { agent, consumer, producer, topic } = t.context
  const message = 'test message'

  agent.on('transactionFinished', (tx) => {
    const name = `MessageBroker/Kafka/Topic/Produce/Named/${topic}`
    const segment = tx.agent.tracer.getSegment()

    const foundSegment = segment.children.find((s) => s.name.endsWith(topic))
    t.equal(foundSegment.name, name)

    const metric = tx.metrics.getMetric(name)
    t.equal(metric.callCount, 1)

    t.end()
  })

  helper.runInTransaction(agent, async (tx) => {
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async ({ message: actualMessage }) => {
          t.equal(actualMessage.value.toString(), message)
          t.match(actualMessage.headers['x-foo'].toString(), 'foo')
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
})
