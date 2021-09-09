/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DESTINATIONS = require('../../../lib/config/attribute-filter').DESTINATIONS
const params = require('../../lib/params')
const metrics = require('../../lib/metrics_helper')

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

function verifySubscribe(t, tx, exchange, routingKey) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')

  if (isCallback) {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
        'amqplib.Channel#consume',
        ['Callback: <anonymous>', ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]]
      ])
    }, 'should have expected segments')
  } else {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
        'amqplib.Channel#consume',
        ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange]
      ])
    }, 'should have expected segments')
  }

  t.doesNotThrow(function () {
    metrics.assertMetrics(
      tx.metrics,
      [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange }]],
      false,
      false
    )
  }, 'should have expected metrics')

  t.notMatch(tx.getFullName(), /^OtherTransaction\/Message/, 'should not set transaction name')

  const consume = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchange
  )
  t.equals(consume.getAttributes().routing_key, routingKey, 'should store routing key')
}

function verifyCAT(t, produceTransaction, consumeTransaction) {
  t.equals(
    consumeTransaction.incomingCatId,
    produceTransaction.agent.config.cross_process_id,
    'should have the proper incoming CAT id'
  )
  t.equals(
    consumeTransaction.referringTransactionGuid,
    produceTransaction.id,
    'should have the the correct referring transaction guid'
  )
  t.equals(consumeTransaction.tripId, produceTransaction.id, 'should have the the correct trip id')
  t.notOk(
    consumeTransaction.invalidIncomingExternalTransaction,
    'invalid incoming external transaction should be false'
  )
}

function verifyDistributedTrace(t, produceTransaction, consumeTransaction) {
  t.ok(produceTransaction.isDistributedTrace, 'should mark producer as distributed')
  t.ok(consumeTransaction.isDistributedTrace, 'should mark consumer as distributed')

  t.equals(consumeTransaction.incomingCatId, null, 'should not set old CAT properties')

  t.equals(produceTransaction.id, consumeTransaction.parentId, 'should have proper parent id')
  t.equals(produceTransaction.traceId, consumeTransaction.traceId, 'should have proper trace id')
  let produceSegment = produceTransaction.trace.root.children[0].children[0]
  produceSegment = produceSegment.children[0] || produceSegment
  t.equals(produceSegment.id, consumeTransaction.parentSpanId, 'should have proper parentSpanId')
  t.equals(consumeTransaction.parentTransportType, 'AMQP', 'should have correct transport type')
}

function verifyConsumeTransaction(t, tx, exchange, queue, routingKey) {
  t.doesNotThrow(function () {
    metrics.assertMetrics(
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
  t.equals(consume, tx.baseSegment)

  const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
  t.equal(
    attributes['message.routingKey'],
    routingKey,
    'should have routing key transaction parameter'
  )
  t.equal(attributes['message.queueName'], queue, 'should have queue name transaction parameter')
}

function verifySendToQueue(t, tx) {
  t.doesNotThrow(function () {
    metrics.assertSegments(tx.trace.root, ['MessageBroker/RabbitMQ/Exchange/Produce/Named/Default'])
  }, 'should have expected segments')

  t.doesNotThrow(function () {
    metrics.assertMetrics(
      tx.metrics,
      [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/Default' }]],
      false,
      false
    )
  }, 'should have expected metrics')

  const segment = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/Default'
  )
  const attributes = segment.getAttributes()
  t.equals(attributes.routing_key, 'testQueue', 'should store routing key')
  t.equals(attributes.reply_to, 'my.reply.queue', 'should store reply to')
  t.equals(attributes.correlation_id, 'correlation-id', 'should store correlation id')
}

function verifyProduce(t, tx, exchangeName, routingKey) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')

  if (isCallback) {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
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
      ])
    }, 'should have expected segments')
  } else {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
        'Channel#assertExchange',
        [
          'Channel#assertQueue',
          ['Channel#bindQueue', ['MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName]]
        ]
      ])
    }, 'should have expected segments')
  }

  t.doesNotThrow(function () {
    metrics.assertMetrics(
      tx.metrics,
      [[{ name: 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName }]],
      false,
      false
    )
  }, 'should have expected metrics')

  const segment = metrics.findSegment(
    tx.trace.root,
    'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
  )
  const attributes = segment.getAttributes()
  if (routingKey) {
    t.equals(attributes.routing_key, routingKey, 'should have routing key')
  } else {
    t.notOk(attributes.routing_key, 'should not have routing key')
  }
}

function verifyGet(t, tx, exchangeName, routingKey, queue) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')
  const produceName = 'MessageBroker/RabbitMQ/Exchange/Produce/Named/' + exchangeName
  const consumeName = 'MessageBroker/RabbitMQ/Exchange/Consume/Named/' + queue
  if (isCallback) {
    t.doesNotThrow(assertions, 'should have expected segments')

    function assertions() {
      metrics.assertSegments(tx.trace.root, [produceName, consumeName, ['Callback: <anonymous>']])
    }
  } else {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [produceName, consumeName])
    }, 'should have expected segments')
  }
  t.doesNotThrow(function () {
    metrics.assertMetrics(
      tx.metrics,
      [[{ name: produceName }], [{ name: consumeName }]],
      false,
      false
    )
  }, 'should have expected metrics')
}

function verifyPurge(t, tx) {
  const isCallback = !!metrics.findSegment(tx.trace.root, 'Callback: <anonymous>')

  if (isCallback) {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
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
      ])
    }, 'should have expected segments')
  } else {
    t.doesNotThrow(function () {
      metrics.assertSegments(tx.trace.root, [
        'Channel#assertExchange',
        ['Channel#assertQueue', ['Channel#bindQueue', ['MessageBroker/RabbitMQ/Queue/Purge/Temp']]]
      ])
    }, 'should have expected segments')
  }

  t.doesNotThrow(function () {
    metrics.assertMetrics(
      tx.metrics,
      [[{ name: 'MessageBroker/RabbitMQ/Queue/Purge/Temp' }]],
      false,
      false
    )
  }, 'should have expected metrics')
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
