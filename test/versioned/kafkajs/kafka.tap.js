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
  t.plan(3)

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
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.send({ acks: 1, topic, messages: [{ key: 'key', value: message }] })
    await promise

    tx.end()
  })
})

tap.test('sendBatch records correctly', (t) => {
  t.plan(3)

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
          messages: [{ key: 'key', value: message }]
        }
      ]
    })
    await promise

    tx.end()
  })
})
