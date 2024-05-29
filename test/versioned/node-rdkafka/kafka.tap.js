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

  const Kafka = require('node-rdkafka')
  t.context.Kafka = Kafka

  await new Promise((resolve) => {
    const producer = new Kafka.Producer({
      'metadata.broker.list': broker
    })
    producer.connect()
    producer.setPollInterval(10)
    producer.on('ready', () => {
      t.context.producer = producer
      resolve()
    })
  })

  await new Promise((resolve) => {
    const consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': broker,
      'group.id': 'kafka'
    })
    consumer.connect()
    consumer.on('ready', () => {
      t.context.consumer = consumer
      resolve()
    })
  })
})

tap.afterEach(async (t) => {
  helper.unloadAgent(t.context.agent)
  removeModules(['node-rdkafka'])

  await new Promise((resolve) => {
    t.context.producer.disconnect(resolve)
  })
  await new Promise((resolve) => {
    t.context.consumer.disconnect(resolve)
  })
})

tap.test('stub', { timeout: 10_000 }, (t) => {
  const { consumer, producer } = t.context
  const topic = 'test-topic'

  consumer.on('data', (data) => {
    t.equal(data.value.toString(), 'test message')
    t.end()
  })
  consumer.subscribe([topic])
  consumer.consume()

  setTimeout(() => {
    producer.produce(topic, null, Buffer.from('test message'), 'key')
  }, 500)
})
