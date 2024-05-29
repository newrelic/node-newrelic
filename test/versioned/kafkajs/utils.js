/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../../../lib/util/hashes')
const utils = module.exports

utils.randomTopic = (prefix = 'test-topic') => {
  return `${prefix}-${makeId()}`
}

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

utils.waitForConsumersToJoinGroup = (consumer, { maxWait = 10000, label = '' } = {}) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      consumer.disconnect().then(() => {
        reject(new Error(`Timeout ${label}`.trim()))
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
