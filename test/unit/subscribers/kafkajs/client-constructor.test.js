/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { AsyncLocalStorage } = require('node:async_hooks')
const { kafkaCtx } = require('#agentlib/symbols.js')
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

/**
 * @param {string} clusterId The cluster UUID the mock admin client should return.
 * @returns {object} A minimal mock of a kafkajs Kafka instance.
 */
function makeKafkaClient(clusterId) {
  return {
    consumer() { return { events: { REQUEST: 'request' }, on() {}, connect() {}, disconnect() {}, run() {}, subscribe() {}, seek() {}, pause() {}, resume() {}, stop() {}, commitOffsets() {} } },
    producer() { return { send() {}, sendBatch() {} } },
    admin() {
      return {
        connect: () => Promise.resolve(),
        describeCluster: () => Promise.resolve({ clusterId }),
        disconnect: () => Promise.resolve()
      }
    }
  }
}

/**
 * Calls subscriber.end() and returns the populated kafkaCtx after the async
 * cluster-ID fetch has had a chance to settle.
 *
 * @param {ConstructorSubscriber} subscriber The subscriber under test.
 * @param {object} kafkaOptions The Kafka() constructor options (brokers, ssl, sasl, etc.).
 * @param {string} clusterId The UUID the mock admin client should return.
 * @returns {Promise<object>} The kafkaCtx object on the client.
 */
async function callEnd(subscriber, kafkaOptions, clusterId) {
  const client = makeKafkaClient(clusterId)
  subscriber.end({ arguments: [kafkaOptions], self: client }, {})
  await new Promise(setImmediate)
  return client[kafkaCtx]
}

const BROKERS = ['kafka-a:9092', 'kafka-b:9093']

// ── broker extraction by auth configuration ───────────────────────────────────

test('end(): sets brokers for unauthenticated (no ssl, no sasl)', async () => {
  const ctx = await callEnd(makeSubscriber(), { brokers: BROKERS }, 'cluster-plain')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/PLAIN', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'plain', username: 'user', password: 'secret' }
  }, 'cluster-sasl-plain')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/SCRAM-SHA-256', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-256', username: 'user', password: 'secret' }
  }, 'cluster-scram-256')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/SCRAM-SHA-512', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-512', username: 'user', password: 'secret' }
  }, 'cluster-scram-512')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SASL/OAUTHBEARER with token provider callback', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: {
      mechanism: 'oauthbearer',
      oauthBearerProvider: async () => { return { value: 'my-jwt-token', lifetime: 900 } }
    }
  }, 'cluster-oauth')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for mTLS/SSL (ssl object)', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    ssl: { ca: '---CA---', cert: '---CERT---', key: '---KEY---' }
  }, 'cluster-mtls')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

test('end(): sets brokers for SSL-only (ssl: true)', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    ssl: true
  }, 'cluster-ssl-bool')
  assert.deepStrictEqual(ctx.brokers, BROKERS)
})

// ── cluster ID propagation by auth configuration ──────────────────────────────

test('end(): propagates cluster ID for SASL/PLAIN', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'plain', username: 'user', password: 'secret' }
  }, 'cluster-sasl-plain')
  assert.strictEqual(ctx.clusterId, 'cluster-sasl-plain')
})

test('end(): propagates cluster ID for SASL/SCRAM-SHA-256', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-256', username: 'user', password: 'secret' }
  }, 'cluster-scram-256')
  assert.strictEqual(ctx.clusterId, 'cluster-scram-256')
})

test('end(): propagates cluster ID for SASL/SCRAM-SHA-512', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: { mechanism: 'scram-sha-512', username: 'user', password: 'secret' }
  }, 'cluster-scram-512')
  assert.strictEqual(ctx.clusterId, 'cluster-scram-512')
})

test('end(): propagates cluster ID for SASL/OAUTHBEARER', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    sasl: {
      mechanism: 'oauthbearer',
      oauthBearerProvider: async () => { return { value: 'my-jwt-token', lifetime: 900 } }
    }
  }, 'cluster-oauth')
  assert.strictEqual(ctx.clusterId, 'cluster-oauth')
})

test('end(): propagates cluster ID for mTLS/SSL', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: BROKERS,
    ssl: { ca: '---CA---', cert: '---CERT---', key: '---KEY---' }
  }, 'cluster-mtls')
  assert.strictEqual(ctx.clusterId, 'cluster-mtls')
})

// ── function-based brokers ────────────────────────────────────────────────────

test('end(): stores empty brokers array for function-based broker resolver', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: async () => BROKERS
  }, 'cluster-dynamic')
  assert.deepStrictEqual(ctx.brokers, [])
})

test('end(): does not fetch or set cluster ID for function-based broker resolver', async () => {
  const ctx = await callEnd(makeSubscriber(), {
    brokers: () => BROKERS
  }, 'cluster-dynamic')
  assert.strictEqual(ctx.clusterId, undefined)
})

// ── helpers for cluster-metrics tests ─────────────────────────────────────────

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

/** Calls end(), waits for the async cluster-ID fetch to settle, returns { client, metrics }. */
async function setupWithCache(opts) {
  const { subscriber, metrics } = makeSubscriberFull(opts)
  const client = makeKafkaClient(CLUSTER_ID)
  subscriber.end({ arguments: [{ brokers: BROKERS }], self: client }, {})
  await new Promise(setImmediate)
  return { client, metrics }
}

// ── #refreshAndRecordProduceMetrics via producer.send() (non-tx path) ─────────

test('producer.send(): kafka_cluster_metrics off → no cluster produce metric', async () => {
  const { client, metrics } = await setupWithCache({ kafka_cluster_metrics: false })
  const producer = client.producer()
  producer.send({ topic: 'orders', messages: [{ value: 'a' }] })
  assert.strictEqual(metrics.store.has(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/orders/Produce`), false)
})

test('producer.send(): cluster ID cached → records produce metric', async () => {
  const { client, metrics } = await setupWithCache({ kafka_cluster_metrics: true })
  const producer = client.producer()
  producer.send({ topic: 'orders', messages: [{ value: 'a' }, { value: 'b' }] })
  assert.strictEqual(metrics.store.get(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/orders/Produce`)?.callCount, 2)
})

test('producer.sendBatch(): cluster ID cached → records produce metric per topic', async () => {
  const { client, metrics } = await setupWithCache({ kafka_cluster_metrics: true })
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

test('producer.send(): cluster ID not yet cached, kafkaCtx.clusterId fallback → records metric with fallback', async () => {
  const { subscriber, metrics } = makeSubscriberFull({ kafka_cluster_metrics: true })
  const client = makeKafkaClient(CLUSTER_ID)
  subscriber.end({ arguments: [{ brokers: BROKERS }], self: client }, {})
  // Do NOT await – cluster ID is in-flight but not yet cached; fallback value is used instead.
  client[kafkaCtx].clusterId = 'fallback-id'
  const producer = client.producer()
  producer.send({ topic: 'events', messages: [{ value: 'x' }] })
  assert.strictEqual(metrics.store.get('MessageBroker/Kafka/Cluster/fallback-id/Topic/events/Produce')?.callCount, 1)
})

test('producer.send(): no cached ID, no kafkaCtx.clusterId → no metric recorded', async () => {
  const { subscriber, metrics } = makeSubscriberFull({ kafka_cluster_metrics: true })
  const client = makeKafkaClient(CLUSTER_ID)
  subscriber.end({ arguments: [{ brokers: BROKERS }], self: client }, {})
  // Do NOT await; remove _kafkaClient so no background fetch is triggered.
  client[kafkaCtx]._kafkaClient = null
  const producer = client.producer()
  producer.send({ topic: 'events', messages: [{ value: 'x' }] })
  assert.strictEqual(metrics.store.has(`MessageBroker/Kafka/Cluster/${CLUSTER_ID}/Topic/events/Produce`), false)
})

// ── eachBatch cluster consume metrics (active-transaction path) ───────────────

test('consumer.run({ eachBatch }): cluster ID cached → records consume metric per message', async () => {
  const { client, metrics } = await setupWithCache({ kafka_cluster_metrics: true, withTransaction: true })
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

// ── admin() is not called with auth options directly ──────────────────────────

test('end(): admin() is called with no arguments (auth inherited via kafkajs closure)', async () => {
  const subscriber = makeSubscriber()
  let adminCallArgs
  const client = {
    consumer() { return { events: { REQUEST: 'request' }, on() {}, connect() {}, disconnect() {}, run() {}, subscribe() {}, seek() {}, pause() {}, resume() {}, stop() {}, commitOffsets() {} } },
    producer() { return { send() {}, sendBatch() {} } },
    admin(...args) {
      adminCallArgs = args
      return {
        connect: () => Promise.resolve(),
        describeCluster: () => Promise.resolve({ clusterId: 'cluster-no-args' }),
        disconnect: () => Promise.resolve()
      }
    }
  }
  subscriber.end({
    arguments: [{ brokers: BROKERS, sasl: { mechanism: 'scram-sha-256', username: 'u', password: 'p' } }],
    self: client
  }, {})
  await new Promise(setImmediate)
  assert.deepStrictEqual(adminCallArgs, [], 'admin() must be called with no arguments so kafkajs inherits auth from its closure')
})
