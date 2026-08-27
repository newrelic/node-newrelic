/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Transport = require('#agentlib/transaction/distributed-trace/transport.js')

test('exposes the transport type values', () => {
  assert.equal(Transport.AMQP, 'AMQP')
  assert.equal(Transport.HTTP, 'HTTP')
  assert.equal(Transport.HTTPS, 'HTTPS')
  assert.equal(Transport.IRONMQ, 'IronMQ')
  assert.equal(Transport.JMS, 'JMS')
  assert.equal(Transport.KAFKA, 'Kafka')
  assert.equal(Transport.OTHER, 'Other')
  assert.equal(Transport.QUEUE, 'Queue')
  assert.equal(Transport.UNKNOWN, 'Unknown')
})

test('values() returns the valid transport values', () => {
  assert.deepEqual(Transport.values(), [
    'AMQP',
    'HTTP',
    'HTTPS',
    'IronMQ',
    'JMS',
    'Kafka',
    'Other',
    'Queue',
    'Unknown'
  ])
})

test('entries() yields KEY->value pairs', () => {
  assert.deepEqual(Transport.entries(), [
    ['AMQP', 'AMQP'],
    ['HTTP', 'HTTP'],
    ['HTTPS', 'HTTPS'],
    ['IRONMQ', 'IronMQ'],
    ['JMS', 'JMS'],
    ['KAFKA', 'Kafka'],
    ['OTHER', 'Other'],
    ['QUEUE', 'Queue'],
    ['UNKNOWN', 'Unknown']
  ])
})

test('isValid() accepts valid transport values', () => {
  assert.equal(Transport.isValid('AMQP'), true)
  assert.equal(Transport.isValid('Kafka'), true)
  assert.equal(Transport.isValid('Unknown'), true)
})

test('isValid() rejects invalid values', () => {
  assert.equal(Transport.isValid('nope'), false)
  assert.equal(Transport.isValid(), false)
  assert.equal(Transport.isValid(null), false)
  // Rejects the KEY names — only values are valid.
  assert.equal(Transport.isValid('IRONMQ'), false)
  // Inherited Object props must not validate as transports.
  assert.equal(Transport.isValid('toString'), false)
})
