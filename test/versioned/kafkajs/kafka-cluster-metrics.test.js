/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const { removeModules } = require('../../lib/cache-buster')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')
const utils = require('./utils')

const broker = `${params.kafka_host}:${params.kafka_port}`

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    feature_flag: {
      kafkajs_instrumentation: true
    },
    kafka: {
      metrics: {
        cluster: {
          metrics: {
            enabled: true
          }
        }
      }
    }
  })

  const { Kafka, logLevel } = require('kafkajs')
  ctx.nr.Kafka = Kafka
  const topic = helper.randomString('topic')
  ctx.nr.topic = topic
  const clientId = helper.randomString('kafka-test')

  const kafka = new Kafka({
    clientId,
    brokers: [broker],
    logLevel: logLevel.NOTHING
  })
  await utils.createTopic({ topic, kafka })

  const admin = kafka.admin()
  await admin.connect()
  const { clusterId } = await admin.describeCluster()
  await admin.disconnect()
  ctx.nr.clusterId = clusterId

  const producer = kafka.producer()
  await producer.connect()
  ctx.nr.producer = producer
  const consumer = kafka.consumer({ groupId: 'kafka' })
  await consumer.connect()
  ctx.nr.consumer = consumer
})

test.afterEach(async (ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['kafkajs'])
  await ctx.nr.consumer.disconnect()
  await ctx.nr.producer.disconnect()
})

test('send records the cluster metric', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, consumer, producer, topic, clusterId } = t.nr
  const expectedName = 'produce-tx'

  agent.on('transactionFinished', (tx) => {
    if (tx.name === expectedName) {
      const nodesMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Produce/${topic}`
      )
      const clusterMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Cluster/${clusterId}/Produce/${topic}`
      )
      plan.equal(clusterMetric.callCount, nodesMetric.callCount)
      plan.equal(clusterMetric.callCount, 1)
    }
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async () => {
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.send({
      acks: 1,
      topic,
      messages: [{ key: 'key', value: 'test message' }]
    })
    await promise

    tx.end()
  })

  await plan.completed
})

test('sendBatch records the cluster metric', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, consumer, producer, topic, clusterId } = t.nr
  const expectedName = 'produce-tx'

  agent.on('transactionFinished', (tx) => {
    if (tx.name === expectedName) {
      const nodesMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Produce/${topic}`
      )
      const clusterMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Cluster/${clusterId}/Produce/${topic}`
      )
      plan.equal(clusterMetric.callCount, nodesMetric.callCount)
      plan.equal(clusterMetric.callCount, 1)
    }
  })

  helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topic, fromBeginning: true })
    const promise = new Promise((resolve) => {
      consumer.run({
        eachMessage: async () => {
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    await producer.sendBatch({
      acks: 1,
      topicMessages: [{ topic, messages: [{ key: 'key', value: 'test message' }] }]
    })
    await promise

    tx.end()
  })

  await plan.completed
})

test('consume outside of a transaction records the cluster metric', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, consumer, producer, topic, clusterId } = t.nr
  const message = 'test message'

  const txPromise = new Promise((resolve) => {
    agent.on('transactionFinished', (tx) => {
      const nodesMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Nodes/${broker}/Consume/${topic}`
      )
      const clusterMetric = agent.metrics.getMetric(
        `MessageBroker/Kafka/Cluster/${clusterId}/Consume/${topic}`
      )
      plan.equal(clusterMetric.callCount, nodesMetric.callCount)
      plan.equal(clusterMetric.callCount, 1)
      resolve()
    })
  })

  await consumer.subscribe({ topics: [topic], fromBeginning: true })
  const testPromise = new Promise((resolve) => {
    consumer.run({
      eachMessage: async () => {
        resolve()
      }
    })
  })
  await utils.waitForConsumersToJoinGroup({ consumer })
  await producer.send({
    acks: 1,
    topic,
    messages: [{ key: 'key', value: message }]
  })

  await Promise.all([txPromise, testPromise])
  await plan.completed
})

test('consume batch inside of a transaction records the cluster metric', async (t) => {
  const plan = tspl(t, { plan: 2 })
  const { agent, consumer, producer, topic, clusterId } = t.nr
  const expectedName = 'testing-tx-consume'
  const messages = ['one', 'two', 'three']

  const txPromise = new Promise((resolve) => {
    agent.on('transactionFinished', () => {
      resolve()
    })
  })

  await helper.runInTransaction(agent, async (tx) => {
    tx.name = expectedName
    await consumer.subscribe({ topics: [topic], fromBeginning: true })
    const testPromise = new Promise((resolve) => {
      consumer.run({
        eachBatch: async () => {
          const nodesMetric = agent.metrics.getMetric(
            `MessageBroker/Kafka/Nodes/${broker}/Consume/${topic}`
          )
          const clusterMetric = agent.metrics.getMetric(
            `MessageBroker/Kafka/Cluster/${clusterId}/Consume/${topic}`
          )
          plan.equal(clusterMetric.callCount, nodesMetric.callCount)
          plan.equal(clusterMetric.callCount, 1)
          resolve()
        }
      })
    })
    await utils.waitForConsumersToJoinGroup({ consumer })
    const messagePayload = messages.map((m, i) => { return { key: `key-${i}`, value: m } })
    await producer.send({
      acks: 1,
      topic,
      messages: messagePayload
    })

    tx.end()
    return Promise.all([txPromise, testPromise])
  })

  await plan.completed
})
