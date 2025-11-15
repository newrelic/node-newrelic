/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { assertMetrics, assertSpanKind } = require('../../lib/custom-assertions')
const utils = module.exports
const metrics = require('../../lib/metrics_helper')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

/**
 * Creates a topic with the admin class
 * @param {object} params to function
 * @param {object} params.kafka instance of kafka.Kafka
 * @param {string} params.topic topic name
 */
utils.createTopic = async ({ kafka, topic }) => {
  const admin = kafka.admin()
  try {
    await admin.connect()
    await admin.createTopics({
      waitForLeaders: true,
      topics: [{ topic, numPartitions: 1, replicationFactor: 1, configEntries: [] }]
    })
  } finally {
    await admin.disconnect()
  }
}

/**
 * Waits for consumer to join the group
 *
 * @param {object} params to function
 * @param {object} params.consumer instance of kafkajs.Kafka.consumer
 * @param {number} [params.maxWait] how long to wait for consumer to join group
 * @returns {Promise}
 *
 */
utils.waitForConsumersToJoinGroup = ({ consumer, maxWait = 10000 }) => new Promise((resolve, reject) => {
  const timeoutId = setTimeout(() => {
    consumer.disconnect().then(() => {
      reject(Error('boom'))
    })
  }, maxWait)
  consumer.on(consumer.events.GROUP_JOIN, (event) => {
    clearTimeout(timeoutId)
    resolve(event)
  })
  consumer.on(consumer.events.CRASH, (event) => {
    clearTimeout(timeoutId)
    consumer.disconnect().then(() => {
      reject(event.payload.error)
    })
  })
})

/**
 * Verifies the metrics of the consume transaction. Also verifies the tx name of consme transaction
 * and the relevant tx attributes
 *
 * @param {object} params function params
 * @param {object} params.plan assertion library instance with plan support
 * @param {object} params.tx consumer transaction
 * @param {string} params.topic topic name
 * @param {string} params.clientId client id
 */
utils.verifyConsumeTransaction = ({ plan, tx, topic, clientId }) => {
  const expectedName = `OtherTransaction/Message/Kafka/Topic/Consume/Named/${topic}`
  assertMetrics(
    tx.metrics,
    [
      [{ name: expectedName }],
      [{ name: `Message/Kafka/Topic/Named/${topic}/Received/Bytes` }],
      [{ name: `Message/Kafka/Topic/Named/${topic}/Received/Messages` }],
      [{ name: 'OtherTransaction/Message/all' }],
      [{ name: 'OtherTransaction/all' }],
      [{ name: 'OtherTransactionTotalTime' }]
    ],
    false,
    false,
    { assert: plan }
  )

  plan.equal(tx.getFullName(), expectedName)
  const consume = metrics.findSegment(tx.trace, tx.trace.root, expectedName)
  plan.equal(consume, tx.baseSegment)
  assertSpanKind({
    agent: tx.agent,
    segments: [
      { name: expectedName, kind: 'consumer' }
    ],
    assert: plan
  })

  const attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_SCOPE)
  plan.ok(attributes['kafka.consume.byteCount'], 'should have byteCount')
  plan.equal(attributes['kafka.consume.client_id'], clientId, 'should have client_id')
}

/**
 * Asserts the properties on both the produce and consume transactions
 * @param {object} params function params
 * @param {object} params.plan assertion library instance with plan support
 * @param {object} params.consumeTxs consumer transactions
 * @param {object} params.produceTx produce transaction
 */
utils.verifyDistributedTrace = ({ plan, consumeTxs, produceTx }) => {
  plan.ok(produceTx.isDistributedTrace, 'should mark producer as distributed')
  const [, ,produceSegment] = produceTx.trace.getChildren(produceTx.trace.root.id)
  consumeTxs.forEach((consumeTx) => {
    plan.ok(consumeTx.isDistributedTrace, 'should mark consumer as distributed')
    plan.equal(consumeTx.incomingCatId, null, 'should not set old CAT properties')
    plan.equal(produceTx.id, consumeTx.parentId, 'should have proper parent id')
    plan.equal(produceTx.traceId, consumeTx.traceId, 'should have proper trace id')
    plan.equal(produceSegment.id, consumeTx.parentSpanId, 'should have proper parentSpanId')
    plan.equal(consumeTx.parentTransportType, 'Kafka', 'should have correct transport type')
  })
}
