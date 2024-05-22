/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const params = require('../../lib/params')
const metrics = require('../../lib/metrics_helper')

const CON_STRING = 'amqp://' + params.rabbitmq_host + ':' + params.rabbitmq_port
const { version: pkgVersion } = require('amqplib/package')
const NATIVE_PROMISES = semver.gte(pkgVersion, '0.10.0')

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

function verifySubscribe(t, tx, exchange, routingKey) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')

  let segments = []

  if (isCallback) {
    segments = [
      'amqplib.Channel#consume',
      ['Callback: <anonymous>', ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]]
    ]
  } else if (NATIVE_PROMISES) {
    segments = [
      'amqplib.Channel#consume',
      'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange
    ]
  } else {
    segments = [
      'amqplib.Channel#consume',
      ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]
    ]
  }

  t.assertSegments(tx.trace.root, segments)

  t.assertMetrics(
    tx.metrics,
    [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange }]],
    false,
    false
  )

  t.notMatch(tx.getFullName(), /^OtherTransaction\/Message/, 'should not set transaction name')

  const consume = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange
  )
  t.equal(consume.getAttributes().routing_key, routingKey, 'should store routing key')
}

function verifyCAT(t, produceTransaction, consumeTransaction) {
  t.equal(
    consumeTransaction.incomingCatId,
    produceTransaction.agent.config.cross_process_id,
    'should have the proper incoming CAT id'
  )
  t.equal(
    consumeTransaction.referringTransactionGuid,
    produceTransaction.id,
    'should have the the correct referring transaction guid'
  )
  t.equal(consumeTransaction.tripId, produceTransaction.id, 'should have the the correct trip id')
  t.notOk(
    consumeTransaction.invalidIncomingExternalTransaction,
    'invalid incoming external transaction should be false'
  )
}

function verifyDistributedTrace(t, produceTransaction, consumeTransaction) {
  t.ok(produceTransaction.isDistributedTrace, 'should mark producer as distributed')
  t.ok(consumeTransaction.isDistributedTrace, 'should mark consumer as distributed')

  t.equal(consumeTransaction.incomingCatId, null, 'should not set old CAT properties')

  t.equal(produceTransaction.id, consumeTransaction.parentId, 'should have proper parent id')
  t.equal(produceTransaction.traceId, consumeTransaction.traceId, 'should have proper trace id')
  // native promises flatten the segment tree, grab the product segment as 2nd child of root
  let produceSegment =
    NATIVE_PROMISES && produceTransaction.trace.root.children.length > 1
      ? produceTransaction.trace.root.children[1]
      : produceTransaction.trace.root.children[0].children[0]
  produceSegment = produceSegment.children[0] || produceSegment
  t.equal(produceSegment.id, consumeTransaction.parentSpanId, 'should have proper parentSpanId')
  t.equal(consumeTransaction.parentTransportType, 'AMQP', 'should have correct transport type')
}

function verifyConsumeTransaction(t, tx, exchange, queue, routingKey) {
  t.doesNotThrow(function () {
    t.assertMetrics(
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
  }, 'should have expected metrics')

  t.equal(
    tx.getFullName(),
    'OtherTransaction/Message/RabbitMQ/Exchange/Named/' + exchange,
    'should not set transaction name'
  )

  const consume = metrics.findSegment(
    tx.trace.root,
    'OtherTransaction/Message/RabbitMQ/Exchange/Named/' + exchange
  )
  t.equal(consume, tx.baseSegment)

  const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  t.equal(
    attributes['message.routingKey'],
    routingKey,
    'should have routing key transaction parameter'
  )
  t.equal(attributes['message.queueName'], queue, 'should have queue name transaction parameter')
}

function verifySendToQueue(t, tx) {
  t.assertSegments(tx.trace.root, ['MessageBroker/RabbitMQ/Exchange/Produce/Named/Default'])

  t.assertMetrics(
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
  t.equal(attributes.routing_key, 'testQueue', 'should store routing key')
  t.equal(attributes.reply_to, 'my.reply.queue', 'should store reply to')
  t.equal(attributes.correlation_id, 'correlation-id', 'should store correlation id')
}

function verifyProduce(t, tx, exchangeName, routingKey) {
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
    // 0.9.0 flattened the segment tree
    // See: https://github.com/amqp-node/amqplib/pull/635/files
  } else if (semver.gte(pkgVersion, '0.9.0')) {
    segments = [
      'Channel#assertExchange',
      'Channel#assertQueue',
      'Channel#bindQueue',
      'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
    ]
  } else {
    segments = [
      'Channel#assertExchange',
      [
        'Channel#assertQueue',
        ['Channel#bindQueue', ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName]]
      ]
    ]
  }

  t.assertSegments(tx.trace.root, segments, 'should have expected segments')

  t.assertMetrics(
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
    t.equal(attributes.routing_key, routingKey, 'should have routing key')
  } else {
    t.notOk(attributes.routing_key, 'should not have routing key')
  }
}

function verifyGet({ t, tx, exchangeName, routingKey, queue, assertAttr }) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')
  const produceName = 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
  const consumeName = 'MessageBroker/RabbitMQ/Exchange/Consume/Named/' + queue
  if (isCallback) {
    t.assertSegments(tx.trace.root, [produceName, consumeName, ['Callback: <anonymous>']])
  } else {
    t.assertSegments(tx.trace.root, [produceName, consumeName])
  }
  t.assertMetrics(tx.metrics, [[{ name: produceName }], [{ name: consumeName }]], false, false)
  if (assertAttr) {
    const segment = metrics.findSegment(tx.trace.root, consumeName)
    const attributes = segment.getAttributes()
    t.equal(attributes.routing_key, routingKey, 'should have routing key on get')
  }
}

function verifyPurge(t, tx) {
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
    // 0.9.0 flattened the segment tree
    // See: https://github.com/amqp-node/amqplib/pull/635/files
  } else if (semver.gte(pkgVersion, '0.9.0')) {
    segments = [
      'Channel#assertExchange',
      'Channel#assertQueue',
      'Channel#bindQueue',
      'MessageBroker/RabbitMQ/Queue/Purge/Temp'
    ]
  } else {
    segments = [
      'Channel#assertExchange',
      ['Channel#assertQueue', ['Channel#bindQueue', ['MessageBroker/RabbitMQ/Queue/Purge/Temp']]]
    ]
  }

  t.assertSegments(tx.trace.root, segments, 'should have expected segments')

  t.assertMetrics(tx.metrics, [[{ name: 'MessageBroker/RabbitMQ/Queue/Purge/Temp' }]], false, false)
}

function verifyTransaction(t, tx, msg) {
  const seg = tx.agent.tracer.getSegment()
  if (t.ok(seg, 'should have transaction state in ' + msg)) {
    t.equal(seg.transaction.id, tx.id, 'should have correct transaction in ' + msg)
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
          channel: channel
        })
      })
    })
  } else {
    return amqplib.connect(CON_STRING).then(function (conn) {
      return conn.createChannel().then(function (channel) {
        return { connection: conn, channel: channel }
      })
    })
  }
}
