/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const otel = require('@opentelemetry/api')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { otelSynthesis } = require('../../../lib/symbols')
const { SEMATTRS_HTTP_HOST, SEMATTRS_HTTP_METHOD, SEMATTRS_DB_NAME, SEMATTRS_DB_STATEMENT, SEMATTRS_DB_SYSTEM, SEMATTRS_NET_PEER_PORT, SEMATTRS_NET_PEER_NAME, DbSystemValues } = require('@opentelemetry/semantic-conventions')
const { ATTR_MESSAGING_SYSTEM, ATTR_MESSAGING_DESTINATION_KIND, ATTR_MESSAGING_DESTINATION, MESSAGING_SYSTEM_KIND_VALUES } = require('../../../lib/otel/constants')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })
  const api = helper.getAgentApi()
  const tracer = otel.trace.getTracer('hello-world')
  ctx.nr = { agent, api, tracer }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  // disable all global constructs from trace sdk
  otel.trace.disable()
  otel.context.disable()
  otel.propagation.disable()
  otel.diag.disable()
})

// test('Otel internal and NR span tests', (t, end) => {
//   const { agent, api, tracer } = t.nr
//   function main(mainSegment) {
//     tracer.startActiveSpan('hi', (span) => {
//       const segment = agent.tracer.getSegment()
//       assert.equal(segment.name, span.name)
//       assert.equal(segment.parentId, mainSegment.id)
//       span.end()
//       const duration = hrTimeToMilliseconds(span.duration)
//       assert.equal(duration, segment.getDurationInMillis())
//     })

//     api.startSegment('agentSegment', true, () => {
//       const parentSegment = agent.tracer.getSegment()
//       tracer.startActiveSpan('bye', (span) => {
//         const segment = agent.tracer.getSegment()
//         assert.equal(segment.name, span.name)
//         assert.equal(segment.parentId, parentSegment.id)
//         span.end()
//         const duration = hrTimeToMilliseconds(span.duration)
//         assert.equal(duration, segment.getDurationInMillis())
//       })
//     })
//   }
//   helper.runInTransaction(agent, (tx) => {
//     tx.name = 'otel-example-tx'
//     tracer.startActiveSpan('main', (span) => {
//       const segment = agent.tracer.getSegment()
//       main(segment)
//       span.end()
//       assert.equal(span[otelSynthesis], undefined)
//       assert.equal(segment.name, span.name)
//       assert.equal(segment.parentId, tx.trace.root.id)
//       const duration = hrTimeToMilliseconds(span.duration)
//       assert.equal(duration, segment.getDurationInMillis())
//       tx.end()
//       const metrics = tx.metrics.scoped[tx.name]
//       assert.equal(metrics['Custom/main'].callCount, 1)
//       assert.equal(metrics['Custom/hi'].callCount, 1)
//       assert.equal(metrics['Custom/bye'].callCount, 1)
//       const unscopedMetrics = tx.metrics.unscoped
//       assert.equal(unscopedMetrics['Custom/main'].callCount, 1)
//       assert.equal(unscopedMetrics['Custom/hi'].callCount, 1)
//       assert.equal(unscopedMetrics['Custom/bye'].callCount, 1)
//       end()
//     })
//   })
// })

// test('Otel http external span test', (t, end) => {
//   const { agent, tracer } = t.nr
//   helper.runInTransaction(agent, (tx) => {
//     tx.name = 'http-external-test'
//     tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes: { [SEMATTRS_HTTP_HOST]: 'newrelic.com', [SEMATTRS_HTTP_METHOD]: 'GET' } }, (span) => {
//       const segment = agent.tracer.getSegment()
//       assert.equal(segment.name, 'External/newrelic.com')
//       span.end()
//       const duration = hrTimeToMilliseconds(span.duration)
//       assert.equal(duration, segment.getDurationInMillis())
//       tx.end()
//       const metrics = tx.metrics.scoped[tx.name]
//       assert.equal(metrics['External/newrelic.com/http'].callCount, 1)
//       const unscopedMetrics = tx.metrics.unscoped
//       assert.equal(unscopedMetrics['External/newrelic.com/http'].callCount, 1)
//       assert.equal(unscopedMetrics['External/newrelic.com/all'].callCount, 1)
//       assert.equal(unscopedMetrics['External/all'].callCount, 1)
//       assert.equal(unscopedMetrics['External/allWeb'].callCount, 1)
//       end()
//     })
//   })
// })

// test('Otel db client span statement test', (t, end) => {
//   const { agent, tracer } = t.nr
//   const attributes = {
//     [SEMATTRS_DB_NAME]: 'test-db',
//     [SEMATTRS_DB_SYSTEM]: 'postgresql',
//     [SEMATTRS_DB_STATEMENT]: "select foo from test where foo = 'bar';",
//     [SEMATTRS_NET_PEER_PORT]: 5436,
//     [SEMATTRS_NET_PEER_NAME]: '127.0.0.1'
//   }
//   const expectedHost = agent.config.getHostnameSafe('127.0.0.1')
//   helper.runInTransaction(agent, (tx) => {
//     tx.name = 'db-test'
//     tracer.startActiveSpan('db-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
//       const segment = agent.tracer.getSegment()
//       assert.equal(segment.name, 'Datastore/statement/postgresql/test/select')
//       span.end()
//       const duration = hrTimeToMilliseconds(span.duration)
//       assert.equal(duration, segment.getDurationInMillis())
//       tx.end()
//       const attrs = segment.getAttributes()
//       assert.equal(attrs.host, expectedHost)
//       assert.equal(attrs.product, 'postgresql')
//       assert.equal(attrs.port_path_or_id, 5436)
//       assert.equal(attrs.database_name, 'test-db')
//       assert.equal(attrs.sql_obfuscated, 'select foo from test where foo = ?;')
//       const metrics = tx.metrics.scoped[tx.name]
//       assert.equal(metrics['Datastore/statement/postgresql/test/select'].callCount, 1)
//       const unscopedMetrics = tx.metrics.unscoped
//       ;[
//         'Datastore/all',
//         'Datastore/allWeb',
//         'Datastore/postgresql/all',
//         'Datastore/postgresql/allWeb',
//         'Datastore/operation/postgresql/select',
//         'Datastore/statement/postgresql/test/select',
//         `Datastore/instance/postgresql/${expectedHost}/5436`
//       ].forEach((expectedMetric) => {
//         assert.equal(unscopedMetrics[expectedMetric].callCount, 1)
//       })

//       end()
//     })
//   })
// })

// test('Otel db client span operation test', (t, end) => {
//   const { agent, tracer } = t.nr
//   const attributes = {
//     [SEMATTRS_DB_SYSTEM]: DbSystemValues.REDIS,
//     [SEMATTRS_DB_STATEMENT]: 'hset has random random',
//     [SEMATTRS_NET_PEER_PORT]: 5436,
//     [SEMATTRS_NET_PEER_NAME]: '127.0.0.1'
//   }
//   const expectedHost = agent.config.getHostnameSafe('127.0.0.1')
//   helper.runInTransaction(agent, (tx) => {
//     tx.name = 'db-test'
//     tracer.startActiveSpan('db-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
//       const segment = agent.tracer.getSegment()
//       assert.equal(segment.name, 'Datastore/operation/redis/hset')
//       span.end()
//       const duration = hrTimeToMilliseconds(span.duration)
//       assert.equal(duration, segment.getDurationInMillis())
//       tx.end()
//       const attrs = segment.getAttributes()
//       assert.equal(attrs.host, expectedHost)
//       assert.equal(attrs.product, 'redis')
//       assert.equal(attrs.port_path_or_id, 5436)
//       const metrics = tx.metrics.scoped[tx.name]
//       assert.equal(metrics['Datastore/operation/redis/hset'].callCount, 1)
//       const unscopedMetrics = tx.metrics.unscoped
//       ;[
//         'Datastore/all',
//         'Datastore/allWeb',
//         'Datastore/redis/all',
//         'Datastore/redis/allWeb',
//         'Datastore/operation/redis/hset',
//         `Datastore/instance/redis/${expectedHost}/5436`
//       ].forEach((expectedMetric) => {
//         assert.equal(unscopedMetrics[expectedMetric].callCount, 1)
//       })

//       end()
//     })
//   })
// })

test('Otel db producer span test', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'messaging-lib',
    [ATTR_MESSAGING_DESTINATION_KIND]: MESSAGING_SYSTEM_KIND_VALUES.QUEUE,
    [ATTR_MESSAGING_DESTINATION]: 'test-queue'
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'db-test'
    tracer.startActiveSpan('db-test', { kind: otel.SpanKind.PRODUCER, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'MessageBroker/messaging-lib/queue/Produce/Named/test-queue')
      span.end()
      // const duration = hrTimeToMilliseconds(span.duration)
      // assert.equal(duration, segment.getDurationInMillis())
      // tx.end()
      // const attrs = segment.getAttributes()
      // assert.equal(attrs.host, expectedHost)
      // assert.equal(attrs.product, 'redis')
      // assert.equal(attrs.port_path_or_id, 5436)
      // const metrics = tx.metrics.scoped[tx.name]
      // assert.equal(metrics['Datastore/operation/redis/hset'].callCount, 1)
      // const unscopedMetrics = tx.metrics.unscoped
      // ;[
      //   'Datastore/all',
      //   'Datastore/allWeb',
      //   'Datastore/redis/all',
      //   'Datastore/redis/allWeb',
      //   'Datastore/operation/redis/hset',
      //   `Datastore/instance/redis/${expectedHost}/5436`
      // ].forEach((expectedMetric) => {
      //   assert.equal(unscopedMetrics[expectedMetric].callCount, 1)
      // })

      end()
    })
  })
})
