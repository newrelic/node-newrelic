/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')

tap.beforeEach(async (t) => {
  t.context.agent = helper.instrumentMockedAgent()

  const Kafka = require('node-rdkafka')
  t.context.Kafka = Kafka

  await new Promise((resolve) => {
    const producer = new Kafka.Producer({
      'metadata.broker.list': '127.0.0.1:9092'
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
      'metadata.broker.list': '127.0.0.1:9092',
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
    console.log('consumed')
    t.equal(data.value.toString(), 'test message')
    t.end()
  })
  consumer.subscribe([topic])
  consumer.consume()

  setTimeout(() => {
    console.log('producing')
    producer.produce(topic, null, Buffer.from('test message'), 'key')
  }, 2000)
})
