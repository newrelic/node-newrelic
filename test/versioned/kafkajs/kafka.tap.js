/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const { removeModules } = require('../../lib/cache-buster')

const broker = `${params.kafka_host}:${params.kafka_port}`

tap.beforeEach(async (t) => {
  t.context.agent = helper.instrumentMockedAgent()

  const { Kafka } = require('kafkajs')
  t.context.Kafka = Kafka
  const kafka = new Kafka({
    clientId: 'kafka-test',
    brokers: [broker]
  })

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
  const { consumer, producer } = t.context
  const topic = 'test-topic'

  await consumer.subscribe({ topics: [topic] })
  const testPromise = new Promise((resolve) => {
    consumer.run({
      eachMessage: async ({ message }) => {
        t.equal(message.value.toString(), 'test message')
        resolve()
      }
    })
  })
  await producer.send({
    topic,
    messages: [{ key: 'key', value: 'test message' }]
  })
  await testPromise
})
