/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const MessageBrokerDescription = require('#agentlib/message-broker-description.js')

test('static constants', async (t) => {
  await t.test('defines broker mode constants', () => {
    assert.equal(MessageBrokerDescription.BROKER_MODE_CONSUME, 'Consume')
    assert.equal(MessageBrokerDescription.BROKER_MODE_PRODUCE, 'Produce')
  })

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
    assert.equal(MessageBrokerDescription.TRANSPORT_TYPE_QUEUE, 'Queue')
  })

  await t.test('TRANSPORT_TYPE_QUEUE equals DESTINATION_TYPE_QUEUE', () => {
    assert.equal(
      MessageBrokerDescription.TRANSPORT_TYPE_QUEUE,
      MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    )
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

  await t.test('preserves user-provided destinationType for AMQP library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'AMQP',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/AMQP/Queue/Produce/Temp'
    )
  })

  await t.test('preserves user-provided destinationType for IronMQ library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'IronMQ',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/IronMQ/Queue/Produce/Temp'
    )
  })

  await t.test('preserves user-provided destinationType for Kafka library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Queue/Produce/Temp'
    )
  })

  await t.test('preserves user-provided destinationType for RabbitMQ library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/Queue/Produce/Temp'
    )
  })

  await t.test('preserves user-provided destinationType even for case-insensitive library names', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'kafka',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/kafka/Topic/Produce/Temp'
    )
  })

  await t.test('defaults to Exchange when no destinationType provided for AMQP', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'AMQP'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/AMQP/Exchange/Produce/Temp'
    )
  })

  await t.test('defaults to Exchange when no destinationType provided for IronMQ', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'IronMQ'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/IronMQ/Exchange/Produce/Temp'
    )
  })

  await t.test('defaults to Exchange when no destinationType provided for Kafka', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Exchange/Produce/Temp'
    )
  })

  await t.test('defaults to Exchange when no destinationType provided for RabbitMQ', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/Exchange/Produce/Temp'
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

  await t.test('sets default mode to PRODUCE when not provided', () => {
    const desc = new MessageBrokerDescription({ libraryName: 'TestLib' })
    assert.equal(
      desc.segmentName,
      'MessageBroker/TestLib/Exchange/Produce/Temp'
    )
  })

  await t.test('uses provided mode parameter', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'TestLib',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/TestLib/Exchange/Consume/Temp'
    )
  })

  await t.test('mode CONSUME works with Queue destination type', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SQS',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE,
      destinationName: 'my-queue',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SQS/Queue/Consume/Named/my-queue'
    )
  })

  await t.test('mode CONSUME works with Topic destination type', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC,
      destinationName: 'my-topic',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Topic/Consume/Named/my-topic'
    )
  })

  await t.test('mode CONSUME preserves user-provided destinationType for special library types', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE,
      destinationName: 'events-topic',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Queue/Consume/Named/events-topic'
    )
  })

  await t.test('mode PRODUCE works with AMQP library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'AMQP',
      destinationName: 'exchange-name',
      mode: MessageBrokerDescription.BROKER_MODE_PRODUCE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/AMQP/Exchange/Produce/Named/exchange-name'
    )
  })

  await t.test('mode CONSUME works with RabbitMQ library', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      destinationName: 'my-queue',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/Exchange/Consume/Named/my-queue'
    )
  })

  await t.test('accepts custom mode values', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'CustomLib',
      destinationName: 'custom-queue',
      mode: 'CustomMode'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/CustomLib/Exchange/CustomMode/Named/custom-queue'
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
      'MessageBroker/Kafka/Exchange/Produce/Named/user-events'
    )
  })

  await t.test('uses "Temp" when destinationName is null', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      destinationName: null
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/RabbitMQ/Exchange/Produce/Temp'
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

  await t.test('includes mode in segment name for CONSUME', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SQS',
      destinationName: 'test-queue',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE,
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SQS/Queue/Consume/Named/test-queue'
    )
  })

  await t.test('includes mode in segment name for PRODUCE', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationName: 'my-topic',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC,
      mode: MessageBrokerDescription.BROKER_MODE_PRODUCE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Topic/Produce/Named/my-topic'
    )
  })

  await t.test('mode affects position in segment path', () => {
    const produceDesc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'events',
      mode: MessageBrokerDescription.BROKER_MODE_PRODUCE
    })
    const consumeDesc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'events',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })

    assert.equal(
      produceDesc.segmentName,
      'MessageBroker/Kafka/Exchange/Produce/Named/events'
    )
    assert.equal(
      consumeDesc.segmentName,
      'MessageBroker/Kafka/Exchange/Consume/Named/events'
    )
  })

  await t.test('CONSUME mode with TRANSPORT_TYPE_QUEUE constant', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'GenericQueue',
      destinationType: MessageBrokerDescription.TRANSPORT_TYPE_QUEUE,
      destinationName: 'work-queue',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/GenericQueue/Queue/Consume/Named/work-queue'
    )
  })

  await t.test('PRODUCE mode with TRANSPORT_TYPE_QUEUE constant', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'GenericQueue',
      destinationType: MessageBrokerDescription.TRANSPORT_TYPE_QUEUE,
      destinationName: 'work-queue',
      mode: MessageBrokerDescription.BROKER_MODE_PRODUCE
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/GenericQueue/Queue/Produce/Named/work-queue'
    )
  })

  await t.test('mode with unnamed destination uses Temp', () => {
    const consumeDesc = new MessageBrokerDescription({
      libraryName: 'TestLib',
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME
    })
    const produceDesc = new MessageBrokerDescription({
      libraryName: 'TestLib',
      mode: MessageBrokerDescription.BROKER_MODE_PRODUCE
    })

    assert.equal(
      consumeDesc.segmentName,
      'MessageBroker/TestLib/Exchange/Consume/Temp'
    )
    assert.equal(
      produceDesc.segmentName,
      'MessageBroker/TestLib/Exchange/Produce/Temp'
    )
  })
})

test('includeMessageBrokerPrefix parameter', async (t) => {
  await t.test('defaults to true when not provided', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'my-topic'
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/Kafka/Exchange/Produce/Named/my-topic'
    )
  })

  await t.test('includes MessageBroker prefix when explicitly set to true', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SNS',
      destinationName: 'my-topic',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC,
      includeMessageBrokerPrefix: true
    })
    assert.equal(
      desc.segmentName,
      'MessageBroker/SNS/Topic/Produce/Named/my-topic'
    )
  })

  await t.test('omits MessageBroker prefix when set to false', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'my-topic',
      includeMessageBrokerPrefix: false
    })
    assert.equal(
      desc.segmentName,
      'Kafka/Exchange/Produce/Named/my-topic'
    )
  })

  await t.test('omits MessageBroker prefix with CONSUME mode', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'SQS',
      destinationName: 'my-queue',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_QUEUE,
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME,
      includeMessageBrokerPrefix: false
    })
    assert.equal(
      desc.segmentName,
      'SQS/Queue/Consume/Named/my-queue'
    )
  })

  await t.test('omits MessageBroker prefix with unnamed destination', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'RabbitMQ',
      includeMessageBrokerPrefix: false
    })
    assert.equal(
      desc.segmentName,
      'RabbitMQ/Exchange/Produce/Temp'
    )
  })

  await t.test('omits MessageBroker prefix with AMQP transport type', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'AMQP',
      destinationName: 'exchange-name',
      includeMessageBrokerPrefix: false
    })
    assert.equal(
      desc.segmentName,
      'AMQP/Exchange/Produce/Named/exchange-name'
    )
  })

  await t.test('omits MessageBroker prefix with custom mode', () => {
    const desc = new MessageBrokerDescription({
      libraryName: 'CustomLib',
      destinationName: 'custom-queue',
      mode: 'CustomMode',
      includeMessageBrokerPrefix: false
    })
    assert.equal(
      desc.segmentName,
      'CustomLib/Exchange/CustomMode/Named/custom-queue'
    )
  })

  await t.test('works correctly with all parameters including prefix control', () => {
    const withPrefix = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'events',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC,
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME,
      includeMessageBrokerPrefix: true
    })
    const withoutPrefix = new MessageBrokerDescription({
      libraryName: 'Kafka',
      destinationName: 'events',
      destinationType: MessageBrokerDescription.DESTINATION_TYPE_TOPIC,
      mode: MessageBrokerDescription.BROKER_MODE_CONSUME,
      includeMessageBrokerPrefix: false
    })

    assert.equal(
      withPrefix.segmentName,
      'MessageBroker/Kafka/Topic/Consume/Named/events'
    )
    assert.equal(
      withoutPrefix.segmentName,
      'Kafka/Topic/Consume/Named/events'
    )
  })
})
