/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const params = require('../../lib/params')
const metrics = require('../../lib/metrics_helper')
const { assertMetrics, assertSegments } = require('./../../lib/custom-assertions')

const CON_STRING = 'amqp://' + params.rabbitmq_host + ':' + params.rabbitmq_port
exports.CON_STRING = CON_STRING
exports.DIRECT_EXCHANGE = 'test-direct-exchange'
exports.FANOUT_EXCHANGE = 'test-fanout-exchange'

exports.verifySubscribe = verifySubscribe
exports.verifyConsumeTransaction = verifyConsumeTransaction
exports.verifyProduce = verifyProduce
exports.verifyCAT = verifyCAT
exports.verifyDistributedTrace = verifyDistributedTrace
exports.verifyGet = verifyGet
exports.verifyPurge = verifyPurge
exports.verifySendToQueue = verifySendToQueue
exports.verifyTransaction = verifyTransaction
exports.getChannel = getChannel

function verifySubscribe(tx, exchange, routingKey) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')

  let segments = []

  if (isCallback) {
    segments = [
      ['Callback: <anonymous>', ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]]
    ]
  } else {
    segments = ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]
  }

  assertSegments(tx.trace.root, segments)

  assertMetrics(
    tx.metrics,
    [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange }]],
    false,
    false
  )

  assert.equal(tx.getFullName(), null, 'should not set transaction name')

  const consume = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange
  )
  assert.equal(consume.getAttributes().routing_key, routingKey, 'should store routing key')
}

function verifyCAT(produceTransaction, consumeTransaction) {
  assert.equal(
    consumeTransaction.incomingCatId,
    produceTransaction.agent.config.cross_process_id,
    'should have the proper incoming CAT id'
  )
  assert.equal(
    consumeTransaction.referringTransactionGuid,
    produceTransaction.id,
    'should have the the correct referring transaction guid'
  )
  assert.equal(
    consumeTransaction.tripId,
    produceTransaction.id,
    'should have the the correct trip id'
  )
  assert.ok(
    !consumeTransaction.invalidIncomingExternalTransaction,
    'invalid incoming external transaction should be false'
  )
}

function verifyDistributedTrace(produceTransaction, consumeTransaction) {
  assert.ok(produceTransaction.isDistributedTrace, 'should mark producer as distributed')
  assert.ok(consumeTransaction.isDistributedTrace, 'should mark consumer as distributed')

  assert.equal(consumeTransaction.incomingCatId, null, 'should not set old CAT properties')

  assert.equal(produceTransaction.id, consumeTransaction.parentId, 'should have proper parent id')
  assert.equal(
    produceTransaction.traceId,
    consumeTransaction.traceId,
    'should have proper trace id'
  )
  const produceSegment = produceTransaction.trace.root.children[0]
  assert.equal(
    produceSegment.id,
    consumeTransaction.parentSpanId,
    'should have proper parentSpanId'
  )
  assert.equal(consumeTransaction.parentTransportType, 'AMQP', 'should have correct transport type')
}

function verifyConsumeTransaction(tx, exchange, queue, routingKey) {
  assertMetrics(
    tx.metrics,
    [
      [{ name: 'OtherTransaction/Message/RabbitMQ/Exchange/Named/' + exchange }],
      [{ name: 'OtherTransactionTotalTime/Message/RabbitMQ/Exchange/Named/' + exchange }],
      [{ name: 'OtherTransaction/Message/all' }],
      [{ name: 'OtherTransaction/all' }],
      [{ name: 'OtherTransactionTotalTime' }]
    ],
    false,
    false
  )

  assert.equal(
    tx.getFullName(),
    'OtherTransaction/Message/RabbitMQ/Exchange/Named/' + exchange,
    'should not set transaction name'
  )

  const consume = metrics.findSegment(
    tx.trace.root,
    'OtherTransaction/Message/RabbitMQ/Exchange/Named/' + exchange
  )
  assert.equal(consume, tx.baseSegment)
  const segmentAttrs = consume.getAttributes()
  assert.equal(segmentAttrs.host, params.rabbitmq_host, 'should have host on segment')
  assert.equal(segmentAttrs.port, params.rabbitmq_port, 'should have port on segment')

  const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  assert.equal(
    attributes['message.routingKey'],
    routingKey,
    'should have routing key transaction parameter'
  )
  assert.equal(
    attributes['message.queueName'],
    queue,
    'should have queue name transaction parameter'
  )
}

function verifySendToQueue(tx) {
  assertSegments(tx.trace.root, ['MessageBroker/RabbitMQ/Exchange/Produce/Named/Default'])

  assertMetrics(
    tx.metrics,
    [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/Default' }]],
    false,
    false
  )

  const segment = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/Default'
  )
  const attributes = segment.getAttributes()
  assert.equal(attributes.host, params.rabbitmq_host, 'should have host on segment')
  assert.equal(attributes.port, params.rabbitmq_port, 'should have port on segment')
  assert.equal(attributes.routing_key, 'testQueue', 'should store routing key')
  assert.equal(attributes.reply_to, 'my.reply.queue', 'should store reply to')
  assert.equal(attributes.correlation_id, 'correlation-id', 'should store correlation id')
}

function verifyProduce(tx, exchangeName, routingKey) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')
  let segments = []

  if (isCallback) {
    segments = [
      'Channel#assertExchange',
      [
        'Callback: <anonymous>',
        [
          'Channel#assertQueue',
          [
            'Callback: <anonymous>',
            [
              'Channel#bindQueue',
              [
                'Callback: <anonymous>',
                ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName]
              ]
            ]
          ]
        ]
      ]
    ]
  } else {
    segments = [
      'Channel#assertExchange',
      'Channel#assertQueue',
      'Channel#bindQueue',
      'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
    ]
  }

  assertSegments(tx.trace.root, segments, 'should have expected segments')

  assertMetrics(
    tx.metrics,
    [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName }]],
    false,
    false
  )

  const segment = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
  )
  const attributes = segment.getAttributes()
  if (routingKey) {
    assert.equal(attributes.routing_key, routingKey, 'should have routing key')
  } else {
    assert.ok(!attributes.routing_key, 'should not have routing key')
  }

  assert.equal(attributes.host, params.rabbitmq_host, 'should have host on segment')
  assert.equal(attributes.port, params.rabbitmq_port, 'should have port on segment')
}

function verifyGet({ tx, exchangeName, routingKey, queue, assertAttr }) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')
  const produceName = 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
  const consumeName = 'MessageBroker/RabbitMQ/Exchange/Consume/Named/' + queue
  if (isCallback) {
    assertSegments(tx.trace.root, [produceName, consumeName, ['Callback: <anonymous>']])
  } else {
    assertSegments(tx.trace.root, [produceName, consumeName])
  }
  assertMetrics(tx.metrics, [[{ name: produceName }], [{ name: consumeName }]], false, false)
  if (assertAttr) {
    const segment = metrics.findSegment(tx.trace.root, consumeName)
    const attributes = segment.getAttributes()
    assert.equal(attributes.host, params.rabbitmq_host, 'should have host on segment')
    assert.equal(attributes.port, params.rabbitmq_port, 'should have port on segment')
    assert.equal(attributes.routing_key, routingKey, 'should have routing key on get')
  }
}

function verifyPurge(tx) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')
  let segments = []

  if (isCallback) {
    segments = [
      'Channel#assertExchange',
      [
        'Callback: <anonymous>',
        [
          'Channel#assertQueue',
          [
            'Callback: <anonymous>',
            [
              'Channel#bindQueue',
              [
                'Callback: <anonymous>',
                ['MessageBroker/RabbitMQ/Queue/Purge/Temp', ['Callback: <anonymous>']]
              ]
            ]
          ]
        ]
      ]
    ]
  } else {
    segments = [
      'Channel#assertExchange',
      'Channel#assertQueue',
      'Channel#bindQueue',
      'MessageBroker/RabbitMQ/Queue/Purge/Temp'
    ]
  }
  assertSegments(tx.trace.root, segments, 'should have expected segments')

  assertMetrics(tx.metrics, [[{ name: 'MessageBroker/RabbitMQ/Queue/Purge/Temp' }]], false, false)
}

function verifyTransaction(tx, msg) {
  const seg = tx.agent.tracer.getSegment()
  if (seg) {
    assert.equal(seg.transaction.id, tx.id, 'should have correct transaction in ' + msg)
  }
}

function getChannel(amqplib, cb) {
  if (cb) {
    amqplib.connect(CON_STRING, null, function (err, conn) {
      if (err) {
        return cb(err)
      }

      conn.createChannel(function (err, channel) {
        cb(err, {
          connection: conn,
          channel
        })
      })
    })
  } else {
    return amqplib.connect(CON_STRING).then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return { connection: conn, channel }
      })
    })
  }
}
