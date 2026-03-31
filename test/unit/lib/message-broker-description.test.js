/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const MessageBrokerDescription = require('#agentlib/message-broker-description.js')

test('static constants', async (t) => {
  await t.test('defines destination type constants', () => {
    assert.equal(MessageBrokerDescription.DESTINATION_TYPE_EXCHANGE, 'Exchange')
    assert.equal(MessageBrokerDescription.DESTINATION_TYPE_QUEUE, 'Queue')
    assert.equal(MessageBrokerDescription.DESTINATION_TYPE_TOPIC, 'Topic')
  })

  await t.test('defines library name constants', () => {
    assert.equal(MessageBrokerDescription.LIB_IRONMQ, 'IronMQ')
    assert.equal(MessageBrokerDescription.LIB_KAFKA, 'Kafka')
    assert.equal(MessageBrokerDescription.LIB_RABBITMQ, 'RabbitMQ')
    assert.equal(MessageBrokerDescription.LIB_SNS, 'SNS')
    assert.equal(MessageBrokerDescription.LIB_SQS, 'SQS')
  })

  await t.test('defines transport type constants', () => {
    assert.equal(MessageBrokerDescription.TRANSPORT_TYPE_AMQP, 'AMQP')
    assert.equal(MessageBrokerDescription.TRANSPORT_TYPE_IRONMQ, 'IronMQ')
    assert.equal(MessageBrokerDescription.TRANSPORT_TYPE_KAFKA, 'Kafka')
    assert.equal(MessageBrokerDescription.TRANSPORT_TYPE_RABBITMQ, 'AMQP')
  })
})

test('constructor', async (t) => {
  await t.test('creates instance with required libraryName parameter', () => {
    const desc = new MessageBrokerDescription({ libraryName: 'TestLib' })
    assert.ok(desc instanceof MessageBrokerDescription)
  })

  await t.test('sets default destinationType to EXCHANGE when not provided', () => {
    const desc = new MessageBrokerDescription({ libraryName: 'TestLib' })
    assert.equal(
      desc.segmentName,
      'MessageBroker/TestLib/Exchange/Produce/Temp'
    )
  })

  await t.test('uses provided destinationType', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'TestLib',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/TestLib/Queue/Produce/Temp'
    )
  })

  await t.test('uses provided destinationName', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'TestLib',
      destinationName: 'my-queue'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/TestLib/Exchange/Produce/Named/my-queue'
    )
  })

  await t.test('overwrites destinationType for AMQP library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'AMQP',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/AMQP/AMQP/Produce/Temp'
    )
  })

  await t.test('overwrites destinationType for IronMQ library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'IronMQ',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/IronMQ/IronMQ/Produce/Temp'
    )
  })

  await t.test('overwrites destinationType for Kafka library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Kafka/Produce/Temp'
    )
  })

  await t.test('overwrites destinationType for RabbitMQ library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/AMQP/Produce/Temp'
    )
  })

  await t.test('handles case-insensitive library names for special cases', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'kafka',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/kafka/Kafka/Produce/Temp'
    )
  })

  await t.test('does not overwrite destinationType for SNS library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Topic/Produce/Temp'
    )
  })

  await t.test('does not overwrite destinationType for SQS library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SQS',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SQS/Queue/Produce/Temp'
    )
  })
})

test('segmentName getter', async (t) => {
  await t.test('generates correct segment name with all parameters', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationName: 'my-topic',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Topic/Produce/Named/my-topic'
    )
  })

  await t.test('uses "Temp" when destinationName is undefined', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SQS'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SQS/Exchange/Produce/Temp'
    )
  })

  await t.test('uses "Named/" prefix when destinationName is provided', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'user-events'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Kafka/Produce/Named/user-events'
    )
  })

  await t.test('uses "Temp" when destinationName is null', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      destinationName: null
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/AMQP/Produce/Temp'
    )
  })

  await t.test('handles empty string destinationName', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationName: ''
    })
    // Empty string is still a string, so it should use Named/
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Exchange/Produce/Named/'
    )
  })

  await t.test('preserves library name casing in segment', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'MyCustomLib',
      destinationName: 'test-queue',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/MyCustomLib/Queue/Produce/Named/test-queue'
    )
  })
})
