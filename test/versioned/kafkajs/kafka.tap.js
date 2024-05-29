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
  utils.createTopic({ topic, kafka })

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

tap.test('stub', async (t) => {
  const { consumer, producer, topic } = t.context
  const message = 'test message'

  await consumer.subscribe({ topics: [topic], fromBeginning: true })
  const testPromise = new Promise((resolve) => {
    consumer.run({
      eachMessage: async ({ message: actualMessage }) => {
        t.equal(actualMessage.value.toString(), message)
        resolve()
      }
    })
  })
  utils.waitForConsumersToJoinGroup(consumer)
  await producer.send({
    acks: 1,
    topic,
    messages: [{ key: 'key', value: message }]
  })
  await testPromise
})
