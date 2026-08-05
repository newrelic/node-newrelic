/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { AsyncLocalStorage } = require('node:async_hooks')
const { kafkaCtx, kafkaCluster } = require('#agentlib/symbols.js')
const ConstructorSubscriber = require('#agentlib/subscribers/kafkajs/client-constructor.js')

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSubscriber() {
  const als = new AsyncLocalStorage()
  const agent = {
    config: { feature_flag: { kafkajs_instrumentation: true, kafka_cluster_metrics: true } },
    tracer: { _contextManager: { _asyncLocalStorage: als } }
  }
  const logger = { child: () => { return { debug() {}, info() {}, warn() {}, error() {} } } }
  return new ConstructorSubscriber({ agent, logger })
}

function makeKafkaClient() {
  return {
    consumer() { return { events: { REQUEST: 'request' }, on() {}, connect() {}, disconnect() {}, run() {}, subscribe() {}, seek() {}, pause() {}, resume() {}, stop() {}, commitOffsets() {} } },
    producer() { return { send() {}, sendBatch() {} } }
  }
}

/**
 * Calls subscriber.end() and returns the populated kafkaCtx.
 *
 * @param {ConstructorSubscriber} subscriber The subscriber under test.
 * @param {object} kafkaOptions The Kafka() constructor options (brokers, ssl, sasl, etc.).
 * @returns {object} The kafkaCtx object on the client.
 */
function callEnd(subscriber, kafkaOptions) {
  const client = makeKafkaClient()
  subscriber.end({ arguments: [kafkaOptions], self: client }, {})
  return client[kafkaCtx]
}

const BROKERS = ['kafka-a:9092', 'kafka-b:9093']

// ── broker extraction by auth configuration ───────────────────────────────────

test('end(): sets brokers for unauthenticated (no ssl, no sasl)', () => {
  const ctx = callEnd(makeSubscriber(), { brokers: BROKERS })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/PLAIN', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'plain', username: 'user', password: 'secret' }
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/SCRAM-SHA-256', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-256', username: 'user', password: 'secret' }
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/SCRAM-SHA-512', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-512', username: 'user', password: 'secret' }
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/OAUTHBEARER with token provider callback', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: {
      mechanism: 'oauthbearer',
      oauthBearerProvider: async () => { return { value: 'my-jwt-token', lifetime: 900 } }
    }
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for mTLS/SSL (ssl object)', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    ssl: { ca: '---CA---', cert: '---CERT---', key: '---KEY---' }
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SSL-only (ssl: true)', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: BROKERS,
    ssl: true
  })
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

// ── function-based brokers ────────────────────────────────────────────────────

test('end(): stores empty brokers array for function-based broker resolver', () => {
  const ctx = callEnd(makeSubscriber(), {
    brokers: async () => BROKERS
  })
  assert.deepStrictEqual(ctx.brokers, [])
})

// ── helpers for cluster-metrics tests ──────────────────────────────────────────
// Cluster id capture itself is covered by producer-cluster-capture.test.js and
// consumer-cluster-capture.test.js. Here we only verify that client-constructor
// reads it correctly off the instance (via the `kafkaCluster` symbol) and gates
// on the `kafka_cluster_metrics` feature flag.

function makeMetrics() {
  const store = new Map()
  return {
    store,
    getOrCreateMetric(name) {
      if (!store.has(name)) {
        store.set(name, { callCount: 0, incrementCallCount(n = 1) { this.callCount += n } })
      }
      return store.get(name)
    }
  }
}

function makeSubscriberFull({ kafka_cluster_metrics: kafkaClusterMetrics = true, withTransaction = false } = {}) {
  const als = new AsyncLocalStorage()
  const metrics = makeMetrics()
  const fakeSegment = { opaque: false, shimId: null, start() {} }
  const fakeCtx = withTransaction
    ? {
        transaction: { isActive: () => true },
        segment: null,
        enterSegment({ segment }) { return { ...this, segment } }
      }
    : { transaction: null }
  const agent = {
    config: { feature_flag: { kafkajs_instrumentation: true, kafka_cluster_metrics: kafkaClusterMetrics } },
    tracer: {
      _contextManager: { _asyncLocalStorage: als },
      getContext: () => fakeCtx,
      createSegment: () => fakeSegment,
      runInContext: ({ handler, thisArg, args }) => handler.apply(thisArg, args)
    },
    metrics
  }
  const logger = { child: () => { return { debug() {}, info() {}, warn() {}, error() {}, trace() {} } } }
  return { subscriber: new ConstructorSubscriber({ agent, logger }), metrics }
}

const CLUSTER_ID = 'cluster-abc'

/**
 * Calls end() and returns { client, metrics }. The returned producer/consumer
 * instances are annotated with `kafkaCluster` as if the corresponding capture
 * subscriber had already run, mirroring real-world ordering (producer()/
 * consumer() calls run the capture subscriber before our own wrapper reads it).
 */
function setup(opts) {
  const { subscriber, metrics } = makeSubscriberFull(opts)
  const client = makeKafkaClient()
  const origProducer = client.producer
  client.producer = (...args) => {
    const producer = origProducer.apply(client, args)
    producer[kafkaCluster] = { brokerPool: { metadata: { clusterId: CLUSTER_ID } } }
    return producer
  }
  const origConsumer = client.consumer
  client.consumer = (...args) => {
    const consumer = origConsumer.apply(client, args)
    consumer[kafkaCluster] = { brokerPool: { metadata: { clusterId: CLUSTER_ID } } }
    return consumer
  }
  subscriber.end({ arguments: [{ brokers: BROKERS }], self: client }, {})
  return { client, metrics }
}

// ── #refreshAndRecordProduceMetrics via producer.send() (non-tx path) ─────────

test('producer.send(): kafka_cluster_metrics off → no cluster produce metric', () => {
  const { client, metrics } = setup({ kafka_cluster_metrics: false })
  const producer = client.producer()
  producer.send({ topic: 'orders', messages: [{ value: 'a' }] })
  assert.strictEqual(metrics.store.has(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/orders/Produce`), false)
})

test('producer.send(): cluster ID available → records produce metric', () => {
  const { client, metrics } = setup({ kafka_cluster_metrics: true })
  const producer = client.producer()
  producer.send({ topic: 'orders', messages: [{ value: 'a' }, { value: 'b' }] })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/orders/Produce`)?.callCount, 2)
})

test('producer.sendBatch(): cluster ID available → records produce metric per topic', () => {
  const { client, metrics } = setup({ kafka_cluster_metrics: true })
  const producer = client.producer()
  producer.sendBatch({
    topicMessages: [
      { topic: 'topic-a', messages: [{ value: '1' }] },
      { topic: 'topic-b', messages: [{ value: '2' }, { value: '3' }] }
    ]
  })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/topic-a/Produce`)?.callCount, 1)
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/topic-b/Produce`)?.callCount, 2)
})

test('producer.send(): no cluster ID captured → no metric recorded', () => {
  const { subscriber, metrics } = makeSubscriberFull({ kafka_cluster_metrics: true })
  const client = makeKafkaClient()
  subscriber.end({ arguments: [{ brokers: BROKERS }], self: client }, {})
  const producer = client.producer()
  producer.send({ topic: 'events', messages: [{ value: 'x' }] })
  assert.strictEqual(metrics.store.has(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/events/Produce`), false)
})

// ── eachBatch cluster consume metrics (active-transaction path) ───────────────

test('consumer.run({ eachBatch }): cluster ID available → records consume metric per message', () => {
  const { client, metrics } = setup({ kafka_cluster_metrics: true, withTransaction: true })
  const consumer = client.consumer()
  const runArgs = [{ eachBatch: () => {} }]
  consumer.run(...runArgs)
  // After run(), runArgs[0].eachBatch is the wrapped nrWrappedEachBatch closure.
  runArgs[0].eachBatch({ batch: { topic: 'events', messages: [1, 2, 3] } })
  assert.strictEqual(
    metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/events/Consume`)?.callCount,
    3
  )
})
