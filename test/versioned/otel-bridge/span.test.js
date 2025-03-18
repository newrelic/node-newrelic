/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const otel = require('@opentelemetry/api')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')

const helper = require('../../lib/agent_helper')
const { otelSynthesis } = require('../../../lib/symbols')
const { DESTINATIONS: ATTR_DESTINATION } = require('../../../lib/config/attribute-filter')

const { DESTINATIONS } = require('../../../lib/transaction')
const {
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_GRPC_STATUS_CODE,
  ATTR_FAAS_INVOKED_PROVIDER,
  ATTR_FULL_URL,
  ATTR_HTTP_HOST,
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RES_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_STATUS_TEXT,
  ATTR_HTTP_URL,
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID,
  ATTR_MESSAGING_OPERATION,
  ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY,
  ATTR_MESSAGING_SYSTEM,
  ATTR_NET_PEER_NAME,
  ATTR_NET_PEER_PORT,
  ATTR_RPC_METHOD,
  ATTR_RPC_SERVICE,
  ATTR_RPC_SYSTEM,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_URL_SCHEME,
  DB_SYSTEM_VALUES,
  MESSAGING_SYSTEM_KIND_VALUES,
  SPAN_STATUS_CODE
} = require('../../../lib/otel/constants.js')
const { assertSpanKind } = require('../../lib/custom-assertions')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    },
    // for AWS entity linking tests
    cloud: {
      aws: {
        account_id: 123456789123
      }
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

test('mix internal and NR span tests', (t, end) => {
  const { agent, api, tracer } = t.nr
  function main(mainSegment, tx) {
    tracer.startActiveSpan('hi', (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      assert.equal(segment.name, span.name)
      assert.equal(segment.parentId, mainSegment.id)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
    })

    api.startSegment('agentSegment', true, () => {
      const parentSegment = agent.tracer.getSegment()
      tracer.startActiveSpan('bye', (span) => {
        const segment = agent.tracer.getSegment()
        assert.equal(tx.traceId, span.spanContext().traceId)
        assert.equal(segment.name, span.name)
        assert.equal(segment.parentId, parentSegment.id)
        span.end()
        const duration = hrTimeToMilliseconds(span.duration)
        assert.equal(duration, segment.getDurationInMillis())
      })
    })
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'otel-example-tx'
    tracer.startActiveSpan('main', (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      main(segment, tx)
      span.end()
      assert.equal(span[otelSynthesis], undefined)
      assert.equal(segment.name, span.name)
      assert.equal(segment.parentId, tx.trace.root.id)
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: 'main', kind: 'internal' },
          { name: 'hi', kind: 'internal' },
          { name: 'bye', kind: 'internal' },
          { name: 'agentSegment', kind: 'internal' }
        ]
      })
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['Custom/main'].callCount, 1)
      assert.equal(metrics['Custom/hi'].callCount, 1)
      assert.equal(metrics['Custom/bye'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['Custom/main'].callCount, 1)
      assert.equal(unscopedMetrics['Custom/hi'].callCount, 1)
      assert.equal(unscopedMetrics['Custom/bye'].callCount, 1)
      end()
    })
  })
})

test('client span(http) is bridge accordingly', (t, end) => {
  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes: { [ATTR_HTTP_HOST]: 'newrelic.com', [ATTR_NET_PEER_NAME]: 'newrelic.com', [ATTR_HTTP_METHOD]: 'GET' } }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/newrelic.com')
      assert.equal(tx.traceId, span.spanContext().traceId)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'client' }
        ]
      })
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['External/newrelic.com/http'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['External/newrelic.com/http'].callCount, 1)
      assert.equal(unscopedMetrics['External/newrelic.com/all'].callCount, 1)
      assert.equal(unscopedMetrics['External/all'].callCount, 1)
      assert.equal(unscopedMetrics['External/allWeb'].callCount, 1)
      end()
    })
  })
})

test('Http external span is bridged accordingly', (t, end) => {
  const attributes = {
    [ATTR_SERVER_ADDRESS]: 'www.newrelic.com',
    [ATTR_HTTP_REQUEST_METHOD]: 'GET',
    [ATTR_SERVER_PORT]: 8080,
    [ATTR_URL_PATH]: '/search',
    [ATTR_URL_QUERY]: 'q=test',
    [ATTR_URL_SCHEME]: 'https',
    [ATTR_HTTP_HOST]: 'www.newrelic.com',
    [ATTR_FULL_URL]: 'https://www.newrelic.com:8080/search?q=test'
  }

  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'undici-external-test'
    tracer.startActiveSpan('unidic-outbound', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      span.setAttribute(ATTR_HTTP_RES_STATUS_CODE, 200)
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/www.newrelic.com/search')
      assert.equal(tx.traceId, span.spanContext().traceId)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'client' }
        ]
      })

      const attrs = segment.getAttributes()
      const spanAttributes = segment.attributes.get(ATTR_DESTINATION.SPAN_EVENT)
      assert.equal(attrs.procedure, attributes[ATTR_HTTP_REQUEST_METHOD])
      assert.equal(attrs['url.scheme'], attrs[ATTR_URL_SCHEME])
      // attributes.url shouldn't include the query
      assert.equal(attrs.url, `https://${attributes[ATTR_SERVER_ADDRESS]}:8080/search`)
      assert.equal(spanAttributes['http.statusCode'], 200)
      assert.equal(spanAttributes.hostname, attributes[ATTR_SERVER_ADDRESS])
      assert.equal(spanAttributes.port, attributes[ATTR_SERVER_PORT])
      assert.equal(spanAttributes['request.parameters.q'], 'test')
      end()
    })
  })
})

test('Http external span is bridged accordingly(legacy attributes test)', (t, end) => {
  const attributes = {
    [ATTR_NET_PEER_NAME]: 'www.newrelic.com',
    [ATTR_HTTP_METHOD]: 'GET',
    [ATTR_NET_PEER_PORT]: 8080,
    [ATTR_URL_QUERY]: 'q=test',
    [ATTR_HTTP_HOST]: 'www.newrelic.com',
    [ATTR_HTTP_URL]: 'https://www.newrelic.com:8080/search?q=test'
  }

  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      span.setAttribute(ATTR_HTTP_RES_STATUS_CODE, 200)
      span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/www.newrelic.com/search')
      assert.equal(tx.traceId, span.spanContext().traceId)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'client' }
        ]
      })

      const attrs = segment.getAttributes()
      const spanAttributes = segment.attributes.get(ATTR_DESTINATION.SPAN_EVENT)
      assert.equal(attrs.procedure, attributes[ATTR_HTTP_METHOD])
      // attributes.url shouldn't include the query
      assert.equal(attrs.url, `https://${attributes[ATTR_NET_PEER_NAME]}:8080/search`)
      assert.equal(spanAttributes['http.statusCode'], 200)
      assert.equal(spanAttributes['http.statusText'], 'OK')
      assert.equal(spanAttributes.hostname, attributes[ATTR_NET_PEER_NAME])
      assert.equal(spanAttributes.port, attributes[ATTR_NET_PEER_PORT])
      assert.equal(spanAttributes['request.parameters.q'], 'test')
      end()
    })
  })
})

test('client span(db) is bridge accordingly(statement test)', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_DB_NAME]: 'test-db',
    [ATTR_DB_SYSTEM]: 'postgresql',
    [ATTR_DB_STATEMENT]: "select foo from test where foo = 'bar';",
    [ATTR_NET_PEER_PORT]: 5436,
    [ATTR_NET_PEER_NAME]: '127.0.0.1'
  }
  const expectedHost = agent.config.getHostnameSafe('127.0.0.1')
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'db-test'
    tracer.startActiveSpan('db-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'Datastore/statement/postgresql/test/select')
      assert.equal(tx.traceId, span.spanContext().traceId)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'client' }
        ]
      })
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, expectedHost)
      assert.equal(attrs.product, 'postgresql')
      assert.equal(attrs.port_path_or_id, 5436)
      assert.equal(attrs.database_name, 'test-db')
      assert.equal(attrs.sql_obfuscated, 'select foo from test where foo = ?;')
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['Datastore/statement/postgresql/test/select'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
        ;[
        'Datastore/all',
        'Datastore/allWeb',
        'Datastore/postgresql/all',
        'Datastore/postgresql/allWeb',
        'Datastore/operation/postgresql/select',
        'Datastore/statement/postgresql/test/select',
          `Datastore/instance/postgresql/${expectedHost}/5436`
      ].forEach((expectedMetric) => {
        assert.equal(unscopedMetrics[expectedMetric].callCount, 1)
      })

      end()
    })
  })
})

test('client span(db) is bridged accordingly(operation test)', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_DB_SYSTEM]: DB_SYSTEM_VALUES.REDIS,
    [ATTR_DB_STATEMENT]: 'hset has random random',
    [ATTR_NET_PEER_PORT]: 5436,
    [ATTR_NET_PEER_NAME]: '127.0.0.1'
  }
  const expectedHost = agent.config.getHostnameSafe('127.0.0.1')
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'db-test'
    tracer.startActiveSpan('db-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'Datastore/operation/redis/hset')
      assert.equal(tx.traceId, span.spanContext().traceId)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'client' }
        ]
      })
      const attrs = segment.getAttributes()
      assert.equal(attrs.host, expectedHost)
      assert.equal(attrs.product, 'redis')
      assert.equal(attrs.port_path_or_id, 5436)
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['Datastore/operation/redis/hset'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
        ;[
        'Datastore/all',
        'Datastore/allWeb',
        'Datastore/redis/all',
        'Datastore/redis/allWeb',
        'Datastore/operation/redis/hset',
          `Datastore/instance/redis/${expectedHost}/5436`
      ].forEach((expectedMetric) => {
        assert.equal(unscopedMetrics[expectedMetric].callCount, 1)
      })

      end()
    })
  })
})

test('server span is bridged accordingly', (t, end) => {
  const { agent, tracer } = t.nr

  // Required span attributes for incoming HTTP server spans as defined by:
  // https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server-semantic-conventions
  const attributes = {
    [ATTR_HTTP_URL]: 'http://newrelic.com/foo/bar',
    [ATTR_URL_SCHEME]: 'http',
    [ATTR_SERVER_ADDRESS]: 'newrelic.com',
    [ATTR_SERVER_PORT]: 80,
    [ATTR_HTTP_METHOD]: 'GET',
    [ATTR_URL_PATH]: '/foo/bar',
    [ATTR_HTTP_ROUTE]: '/foo/:param'
  }

  tracer.startActiveSpan('http-test', { kind: otel.SpanKind.SERVER, attributes }, (span) => {
    const tx = agent.getTransaction()
    assert.equal(tx.traceId, span.spanContext().traceId)
    span.setAttribute(ATTR_HTTP_RES_STATUS_CODE, 200)
    span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
    span.end()
    assert.ok(!tx.isDistributedTrace)
    const segment = agent.tracer.getSegment()
    assert.equal(segment.name, 'WebTransaction/WebFrameworkUri//GET/foo/:param')
    assertSpanKind({
      agent,
      segments: [
        { name: tx.name, kind: 'server' }
      ]
    })

    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())

    const attrs = segment.getAttributes()
    assert.equal(attrs.host, 'newrelic.com')
    assert.equal(attrs.port, 80)
    assert.equal(attrs['request.method'], 'GET')
    assert.equal(attrs['http.route'], '/foo/:param')
    assert.equal(attrs['url.path'], '/foo/bar')
    assert.equal(attrs['url.scheme'], 'http')
    assert.equal(attrs['http.statusCode'], 200)
    assert.equal(attrs['http.statusText'], 'OK')

    const unscopedMetrics = tx.metrics.unscoped
    const expectedMetrics = [
      'HttpDispatcher',
      'WebTransaction',
      'WebTransactionTotalTime',
      'WebTransactionTotalTime/WebFrameworkUri//GET/foo/:param',
      segment.name
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric} has correct callCount`)
    }
    assert.equal(unscopedMetrics.Apdex.apdexT, 0.1)
    assert.equal(unscopedMetrics['Apdex/WebFrameworkUri//GET/foo/:param'].apdexT, 0.1)

    end()
  })
})

test('server span(rpc) is bridged accordingly', (t, end) => {
  const { agent, tracer } = t.nr

  // Required span attributes for incoming HTTP server spans as defined by:
  // https://opentelemetry.io/docs/specs/semconv/rpc/rpc-spans/#client-attributes
  const attributes = {
    [ATTR_RPC_SYSTEM]: 'foo',
    [ATTR_RPC_METHOD]: 'getData',
    [ATTR_RPC_SERVICE]: 'test.service',
    [ATTR_SERVER_ADDRESS]: 'newrelic.com',
    [ATTR_URL_PATH]: '/foo/bar'
  }

  tracer.startActiveSpan('http-test', { kind: otel.SpanKind.SERVER, attributes }, (span) => {
    span.setAttribute(ATTR_GRPC_STATUS_CODE, 0)
    const tx = agent.getTransaction()
    assert.equal(tx.traceId, span.spanContext().traceId)
    span.end()
    assert.ok(!tx.isDistributedTrace)
    const segment = agent.tracer.getSegment()
    assert.equal(segment.name, 'WebTransaction/WebFrameworkUri/foo/test.service/getData')
    assertSpanKind({
      agent,
      segments: [
        { name: tx.name, kind: 'server' }
      ]
    })

    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())

    const attrs = segment.getAttributes()
    assert.equal(attrs['server.address'], 'newrelic.com')
    assert.equal(attrs['rpc.system'], 'foo')
    assert.equal(attrs.component, 'foo')
    assert.equal(attrs['rpc.method'], 'getData')
    assert.equal(attrs['rpc.service'], 'test.service')
    assert.equal(attrs['url.path'], '/foo/bar')
    assert.equal(attrs['request.method'], 'getData')
    assert.equal(attrs['request.uri'], 'test.service/getData')
    assert.equal(attrs['response.status'], 0)

    const unscopedMetrics = tx.metrics.unscoped
    const expectedMetrics = [
      'HttpDispatcher',
      'WebTransaction',
      'WebTransactionTotalTime',
      'WebTransactionTotalTime/WebFrameworkUri/foo/test.service/getData',
      segment.name
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric} has correct callCount`)
    }
    assert.equal(unscopedMetrics.Apdex.apdexT, 0.1)
    assert.equal(unscopedMetrics['Apdex/WebFrameworkUri/foo/test.service/getData'].apdexT, 0.1)

    end()
  })
})

test('server span(fallback) is bridged accordingly', (t, end) => {
  const { agent, tracer } = t.nr

  const attributes = {
    [ATTR_URL_SCHEME]: 'gopher',
    [ATTR_SERVER_ADDRESS]: '127.0.0.1',
    [ATTR_SERVER_PORT]: 3000,
    [ATTR_URL_PATH]: '/foo/bar',
  }

  const expectedHost = agent.config.getHostnameSafe('127.0.0.1')
  tracer.startActiveSpan('http-test', { kind: otel.SpanKind.SERVER, attributes }, (span) => {
    const tx = agent.getTransaction()
    assert.equal(tx.traceId, span.spanContext().traceId)
    span.end()
    assert.ok(!tx.isDistributedTrace)
    assertSpanKind({
      agent,
      segments: [
        { name: tx.name, kind: 'server' }
      ]
    })
    const segment = agent.tracer.getSegment()

    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())
    assert.equal(segment.name, 'WebTransaction/WebFrameworkUri//unknown')

    const attrs = segment.getAttributes()
    assert.equal(attrs.host, expectedHost)
    assert.equal(attrs.port, 3000)
    assert.equal(attrs['url.path'], '/foo/bar')
    assert.equal(attrs['url.scheme'], 'gopher')
    assert.equal(attrs.nr_exclusive_duration_millis, duration)

    const unscopedMetrics = tx.metrics.unscoped
    const expectedMetrics = [
      'HttpDispatcher',
      'WebTransaction',
      'WebTransactionTotalTime',
      'WebTransactionTotalTime/WebFrameworkUri//unknown',
      segment.name
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric} has correct callCount`)
    }
    assert.equal(unscopedMetrics.Apdex.apdexT, 0.1)
    assert.equal(unscopedMetrics['Apdex/WebFrameworkUri//unknown'].apdexT, 0.1)

    end()
  })
})

test('producer span is bridged accordingly', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'messaging-lib',
    [ATTR_MESSAGING_DESTINATION_KIND]: MESSAGING_SYSTEM_KIND_VALUES.QUEUE,
    [ATTR_MESSAGING_DESTINATION]: 'test-queue',
    [ATTR_SERVER_ADDRESS]: 'localhost',
    [ATTR_SERVER_PORT]: 5672,
    [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'myKey',
    [ATTR_MESSAGING_MESSAGE_CONVERSATION_ID]: 'MyConversationId'
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'prod-test'

    const expectedHost = agent.config.getHostnameSafe('localhost')
    tracer.startActiveSpan('prod-test', { kind: otel.SpanKind.PRODUCER, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(tx.traceId, span.spanContext().traceId)
      assert.equal(segment.name, 'MessageBroker/messaging-lib/queue/Produce/Named/test-queue')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      assertSpanKind({
        agent,
        segments: [
          { name: segment.name, kind: 'producer' }
        ]
      })
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['MessageBroker/messaging-lib/queue/Produce/Named/test-queue'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['MessageBroker/messaging-lib/queue/Produce/Named/test-queue'].callCount, 1)

      const attrs = segment.getAttributes()
      assert.equal(attrs.host, expectedHost)
      assert.equal(attrs.port, 5672)
      assert.equal(attrs.correlation_id, 'MyConversationId')
      assert.equal(attrs.routing_key, 'myKey')
      assert.equal(attrs[ATTR_MESSAGING_SYSTEM], 'messaging-lib')
      assert.equal(attrs[ATTR_MESSAGING_DESTINATION], 'test-queue')
      assert.equal(attrs[ATTR_MESSAGING_DESTINATION_KIND], MESSAGING_SYSTEM_KIND_VALUES.QUEUE)
      end()
    })
  })
})

test('consumer span is bridged correctly', (t, end) => {
  const { agent, tracer } = t.nr
  const expectedHost = agent.config.getHostnameSafe('localhost')
  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'kafka',
    [ATTR_MESSAGING_OPERATION]: 'getMessage',
    [ATTR_SERVER_ADDRESS]: '127.0.0.1',
    [ATTR_SERVER_PORT]: '1234',
    [ATTR_MESSAGING_DESTINATION]: 'work-queue',
    [ATTR_MESSAGING_DESTINATION_KIND]: 'queue',
    [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'test-key'
  }

  tracer.startActiveSpan('consumer-test', { kind: otel.SpanKind.CONSUMER, attributes }, (span) => {
    const tx = agent.getTransaction()
    assert.ok(!tx.isDistributedTrace)
    const segment = agent.tracer.getSegment()
    assert.equal(tx.traceId, span.spanContext().traceId)
    span.end()
    assertSpanKind({
      agent,
      segments: [
        { name: tx.name, kind: 'consumer' }
      ]
    })
    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())

    assert.equal(segment.name, 'OtherTransaction/Message/kafka/queue/Named/work-queue')
    assert.equal(tx.type, 'message')

    const unscopedMetrics = tx.metrics.unscoped
    const expectedMetrics = [
      'OtherTransaction/all',
      'OtherTransaction/Message/all',
      'OtherTransaction/Message/kafka/queue/Named/work-queue',
      'OtherTransactionTotalTime'
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric}.callCount`)
    }

    // Verify that required reconciled attributes are present:
    let attrs = tx.baseSegment.getAttributes()
    assert.equal(attrs.host, expectedHost)
    assert.equal(attrs.port, '1234')
    attrs = tx.trace.attributes.get(DESTINATIONS.TRANS_COMMON)
    assert.equal(attrs['message.queueName'], 'work-queue')
    assert.equal(attrs['message.routingKey'], 'test-key')

    end()
  })
})

test('messaging consumer skips high security attributes', (t, end) => {
  const { agent, tracer } = t.nr
  const expectedHost = agent.config.getHostnameSafe('localhost')
  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'kafka',
    [ATTR_MESSAGING_OPERATION]: 'getMessage',
    [ATTR_SERVER_ADDRESS]: '127.0.0.1',
    [ATTR_SERVER_PORT]: '1234',
    [ATTR_MESSAGING_DESTINATION_KIND]: 'queue',
    [ATTR_MESSAGING_DESTINATION_NAME]: 'test-queue',
    [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: 'test-key'
  }
  agent.config.high_security = true

  tracer.startActiveSpan('consumer-test', { kind: otel.SpanKind.CONSUMER, attributes }, (span) => {
    const tx = agent.getTransaction()
    span.end()

    // Verify that required reconciled attributes are present:
    let attrs = tx.baseSegment.getAttributes()
    assert.equal(attrs.host, expectedHost)
    assert.equal(attrs.port, '1234')
    attrs = tx.trace.attributes.get(DESTINATIONS.TRANS_COMMON)
    assert.equal(attrs['message.queueName'], undefined)
    assert.equal(attrs['message.routingKey'], undefined)

    end()
  })
})

test('consumer span accepts upstream traceparent/tracestate correctly', (t, end) => {
  const { agent, tracer } = t.nr

  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'kafka',
    [ATTR_MESSAGING_OPERATION]: 'getMessage',
    [ATTR_SERVER_ADDRESS]: '127.0.0.1',
    [ATTR_MESSAGING_DESTINATION]: 'work-queue',
    [ATTR_MESSAGING_DESTINATION_KIND]: 'queue'
  }

  const { ctx, traceId, spanId } = setupDtHeaders(agent)
  tracer.startActiveSpan('consumer-test', { kind: otel.SpanKind.CONSUMER, attributes }, ctx, (span) => {
    const tx = agent.getTransaction()
    span.end()
    assertDtAttrs({ tx, traceId, spanId, transportType: 'kafka' })
    end()
  })
})

test('server span accepts upstream traceparent/tracestate correctly', (t, end) => {
  const { agent, tracer } = t.nr

  // Required span attributes for incoming HTTP server spans as defined by:
  // https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server-semantic-conventions
  const attributes = {
    [ATTR_HTTP_URL]: 'http://newrelic.com/foo/bar',
    [ATTR_URL_SCHEME]: 'http',
    [ATTR_SERVER_ADDRESS]: 'newrelic.com',
    [ATTR_SERVER_PORT]: 80,
    [ATTR_HTTP_METHOD]: 'GET',
    [ATTR_URL_PATH]: '/foo/bar',
    [ATTR_HTTP_ROUTE]: '/foo/:param'
  }

  const { ctx, traceId, spanId } = setupDtHeaders(agent)
  tracer.startActiveSpan('http-test', { kind: otel.SpanKind.SERVER, attributes }, ctx, (span) => {
    const tx = agent.getTransaction()
    span.setAttribute(ATTR_HTTP_STATUS_CODE, 200)
    span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
    span.end()
    assertDtAttrs({ tx, traceId, spanId, transportType: 'HTTPS' })

    const unscopedMetrics = tx.metrics.unscoped
    const expectedMetrics = [
      'DurationByCaller/App/1/2827902/HTTPS/all',
      'DurationByCaller/App/1/2827902/HTTPS/allWeb',
      'TransportDuration/App/1/2827902/HTTPS/all',
      'TransportDuration/App/1/2827902/HTTPS/allWeb',
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric} has correct callCount`)
    }
    end()
  })
})

test('server span should not accept upstream traceparent/tracestate if distributed tracing is disabled', (t, end) => {
  const { agent, tracer } = t.nr
  agent.config.distributed_tracing.enabled = false

  // Required span attributes for incoming HTTP server spans as defined by:
  // https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server-semantic-conventions
  const attributes = {
    [ATTR_HTTP_URL]: 'http://newrelic.com/foo/bar',
    [ATTR_URL_SCHEME]: 'http',
    [ATTR_SERVER_ADDRESS]: 'newrelic.com',
    [ATTR_SERVER_PORT]: 80,
    [ATTR_HTTP_METHOD]: 'GET',
    [ATTR_URL_PATH]: '/foo/bar',
    [ATTR_HTTP_ROUTE]: '/foo/:param'
  }

  const { ctx } = setupDtHeaders(agent)
  tracer.startActiveSpan('http-test', { kind: otel.SpanKind.SERVER, attributes }, ctx, (span) => {
    const tx = agent.getTransaction()
    span.setAttribute(ATTR_HTTP_STATUS_CODE, 200)
    span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
    span.end()
    assert.ok(!tx.isDistributedTrace)
    end()
  })
})

test('Span errors are handled and added on transaction', (t, end) => {
  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT }, (span) => {
      span.status.code = SPAN_STATUS_CODE.ERROR

      const errorEvent = {
        name: 'exception',
        attributes: {
          'exception.message': 'Simulated error',
          'exception.stacktrace': 'Error stack trace'
        }
      }
      span.addEvent('exception', errorEvent.attributes)

      span.end()
      tx.end()

      assert.equal(span.events[0].name, 'exception')
      assert.equal(span.events[0].attributes['exception.message'], 'Simulated error')
      assert.equal(span.events[0].attributes['exception.stacktrace'], 'Error stack trace')

      const errorEvents = agent.errors.eventAggregator.getEvents()
      assert.equal(errorEvents.length, 1)
      assert.equal(errorEvents[0][0]['error.message'], 'Simulated error')
      assert.equal(errorEvents[0][0]['error.class'], 'Error')
      assert.equal(errorEvents[0][0]['type'], 'TransactionError')
      end()
    })
  })
})

test('Span errors are not added on transaction when span status code is not error', (t, end) => {
  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT }, (span) => {
      span.status.code = SPAN_STATUS_CODE.OK

      const errorEvent = {
        name: 'exception',
        attributes: {
          'exception.message': 'Simulated error',
          'exception.stacktrace': 'Error stack trace'
        }
      }
      span.addEvent('exception', errorEvent.attributes)

      span.end()
      tx.end()

      assert.equal(span.events[0].name, 'exception')
      assert.equal(span.events[0].attributes['exception.message'], 'Simulated error')
      assert.equal(span.events[0].attributes['exception.stacktrace'], 'Error stack trace')

      // no transaction errors
      const errorEvents = agent.errors.eventAggregator.getEvents()
      assert.equal(errorEvents.length, 0)
      end()
    })
  })
})

test('aws dynamodb span has correct entity linking attributes', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_DB_NAME]: 'test-db',
    [ATTR_DB_SYSTEM]: DB_SYSTEM_VALUES.DYNAMODB,
    [ATTR_DB_STATEMENT]: 'select foo from test-table where foo = "bar"',
    'aws.region': 'us-east-1',
    'aws.dynamodb.table_names': ['test-table']
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'db-test'
    tracer.startActiveSpan('db-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      const attrs = segment.getAttributes()
      assert.equal(attrs['cloud.resource_id'], 'arn:aws:dynamodb:us-east-1:123456789123:table/test-table')
      end()
    })
  })
})

test('aws lambda span has correct entity linking attributes', (t, end) => {
  const { agent, tracer } = t.nr
  // see: https://github.com/open-telemetry/opentelemetry-specification/blob/v1.7.0/specification/trace/semantic_conventions/faas.md#example "Span A"
  const attributes = {
    'faas.invoked_name': 'test-function',
    [ATTR_FAAS_INVOKED_PROVIDER]: 'aws',
    'faas.invoked_region': 'us-east-1'
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'lambda-test'
    tracer.startActiveSpan('lambda-test', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      const attrs = segment.getAttributes()
      assert.equal(attrs['cloud.resource_id'], 'arn:aws:lambda:us-east-1:123456789123:function:test-function')
      assert.equal(attrs['cloud.platform'], 'aws_lambda')
      end()
    })
  })
})

test('aws sqs span has correct entity linking attributes', (t, end) => {
  const { agent, tracer } = t.nr
  // see: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/b520d048465d9b3dfdf275976010c989d2a78a2c/plugins/node/opentelemetry-instrumentation-aws-sdk/src/services/sqs.ts#L62
  const attributes = {
    'rpc.service': 'sqs',
    [ATTR_MESSAGING_DESTINATION_KIND]: MESSAGING_SYSTEM_KIND_VALUES.QUEUE,
    [ATTR_MESSAGING_DESTINATION]: 'test-queue',
    'aws.region': 'us-east-1'
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'sqs-test'
    tracer.startActiveSpan('sqs-test', { kind: otel.SpanKind.PRODUCER, attributes }, (span) => {
      const segment = agent.tracer.getSegment()
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      const attrs = segment.getAttributes()
      assert.equal(attrs['cloud.account.id'], agent.config.cloud.aws.account_id)
      assert.equal(attrs['cloud.region'], 'us-east-1')
      assert.equal(attrs['messaging.destination.name'], 'test-queue')
      assert.equal(attrs['messaging.system'], 'aws_sqs')
      end()
    })
  })
})

function setupDtHeaders(agent) {
  agent.config.trusted_account_key = 1
  agent.config.primary_application_id = 2
  agent.config.account_id = 1
  const spanId = '00f067aa0ba902b7'
  const traceId = '00015f9f95352ad550284c27c5d3084c'
  const traceparent = `00-${traceId}-${spanId}-01`
  const tracestate = `1@nr=0-0-1-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

  const headers = {
    traceparent,
    tracestate
  }
  const ctx = otel.propagation.extract(otel.ROOT_CONTEXT, headers)
  return { ctx, traceId, spanId }
}

function assertDtAttrs({ tx, traceId, spanId, transportType }) {
  assert.equal(tx.acceptedDistributedTrace, true)
  assert.equal(tx.isDistributedTrace, true)
  assert.equal(tx.traceId, traceId)
  assert.equal(tx.parentSpanId, spanId)
  assert.ok(tx.parentTransportDuration >= 0)
  assert.equal(tx.parentTransportType, transportType)
  assert.equal(tx.parentType, 'App')
  assert.equal(tx.parentAcct, '1')
  assert.equal(tx.parentApp, '2827902')
  assert.equal(tx.parentId, 'e8b91a159289ff74')
  assert.equal(tx.sampled, true)
  assert.ok(tx.priority)
}
