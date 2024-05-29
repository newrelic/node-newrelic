/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../../../lib/util/hashes')
const utils = module.exports

/**
 * Creates a random topic to be used for testing
 * @param {string} [prefix=test-topic] topic prefix
 * @returns {string} topic name with random id appended
 */
utils.randomTopic = (prefix = 'test-topic') => {
  return `${prefix}-${makeId()}`
}

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
 * @param {number} [params.maxWait=10000] how long to wait for consumer to join group
 * @returns {Promise}
 *
 */
utils.waitForConsumersToJoinGroup = ({ consumer, maxWait = 10000 }) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      consumer.disconnect().then(() => {
        reject()
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
