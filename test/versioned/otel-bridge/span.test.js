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

const {
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_GRPC_STATUS_CODE,
  ATTR_HTTP_HOST,
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESP_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_STATUS_TEXT,
  ATTR_HTTP_TARGET,
  ATTR_HTTP_URL,
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
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
  MESSAGING_SYSTEM_KIND_VALUES
} = require('../../../lib/otel/constants.js')

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

test('Otel internal and NR span tests', (t, end) => {
  const { agent, api, tracer } = t.nr
  function main(mainSegment) {
    tracer.startActiveSpan('hi', (span) => {
      const segment = agent.tracer.getSegment()
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
      main(segment)
      span.end()
      assert.equal(span[otelSynthesis], undefined)
      assert.equal(segment.name, span.name)
      assert.equal(segment.parentId, tx.trace.root.id)
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
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

test('Otel http external span test', (t, end) => {
  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes: { [ATTR_HTTP_HOST]: 'newrelic.com', [ATTR_HTTP_METHOD]: 'GET' } }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/newrelic.com')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
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

test('Reconcile Otel undici external span attributes test', (t, end) => {
  const attributes = {
    [ATTR_SERVER_ADDRESS]: 'www.newrelic.com',
    [ATTR_HTTP_REQUEST_METHOD]: 'GET',
    [ATTR_SERVER_PORT]: 8080,
    [ATTR_URL_PATH]: '/search',
    [ATTR_URL_QUERY]: 'q=test',
    [ATTR_URL_SCHEME]: 'https',
    [ATTR_HTTP_HOST]: 'www.newrelic.com',
    [ATTR_HTTP_URL]: 'https://www.newrelic.com/search?q=test'
  }

  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'undici-external-test'
    tracer.startActiveSpan('unidic-outbound', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      span.setAttribute(ATTR_HTTP_RESP_STATUS_CODE, 200)
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/www.newrelic.com')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()

      const attrs = segment.getAttributes()
      assert.equal(attrs.procedure, attributes[ATTR_HTTP_REQUEST_METHOD])
      assert.equal(attrs.protocol, attrs[ATTR_URL_SCHEME])
      // attributes.url shouldn't include the query
      assert.equal(attrs.url, `${attributes[ATTR_URL_SCHEME]}://${attributes[ATTR_SERVER_ADDRESS]}${attributes[ATTR_URL_PATH]}`)
      assert.equal(attrs['http.statusCode'], 200)
      assert.equal(attrs.hostname, attributes[ATTR_SERVER_ADDRESS])
      assert.equal(attrs.port, attributes[ATTR_SERVER_PORT])
      end()
    })
  })
})

test('Reconcile Otel http external span attributes test', (t, end) => {
  const attributes = {
    [ATTR_NET_PEER_NAME]: 'www.newrelic.com',
    [ATTR_HTTP_METHOD]: 'GET',
    [ATTR_NET_PEER_PORT]: 8080,
    [ATTR_HTTP_TARGET]: '/search?q=test',
    [ATTR_URL_QUERY]: 'q=test',
    [ATTR_HTTP_HOST]: 'www.newrelic.com',
    [ATTR_HTTP_URL]: 'https://www.newrelic.com/search?q=test'
  }

  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes }, (span) => {
      span.setAttribute(ATTR_HTTP_RESP_STATUS_CODE, 200)
      span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/www.newrelic.com')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()

      const attrs = segment.getAttributes()
      assert.equal(attrs.procedure, attributes[ATTR_HTTP_METHOD])
      // attributes.url shouldn't include the query
      assert.equal(attrs.url, `https://${attributes[ATTR_NET_PEER_NAME]}/search`)
      assert.equal(attrs['http.statusCode'], 200)
      assert.equal(attrs['http.statusText'], 'OK')
      assert.equal(attrs.hostname, attributes[ATTR_NET_PEER_NAME])
      assert.equal(attrs.port, attributes[ATTR_NET_PEER_PORT])
      end()
    })
  })
})

test('Otel db client span statement test', (t, end) => {
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
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
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

test('Otel db client span operation test', (t, end) => {
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
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
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

test('http metrics are bridged correctly', (t, end) => {
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
    span.setAttribute(ATTR_HTTP_RESP_STATUS_CODE, 200)
    span.setAttribute(ATTR_HTTP_STATUS_TEXT, 'OK')
    span.end()
    const segment = agent.tracer.getSegment()
    assert.equal(segment.name, 'WebTransaction/WebFrameworkUri//GET/foo/:param')

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

test('rpc server metrics are bridged correctly', (t, end) => {
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
    span.end()
    const segment = agent.tracer.getSegment()
    assert.equal(segment.name, 'WebTransaction/WebFrameworkUri/foo/test.service/getData')

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

test('fallback metrics are bridged correctly', (t, end) => {
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
    span.end()
    const segment = agent.tracer.getSegment()

    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())
    assert.equal(segment.name, 'WebTransaction/NormalizedUri/*')

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
      'WebTransactionTotalTime/NormalizedUri/*',
      segment.name
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(unscopedMetrics[expectedMetric].callCount, 1, `${expectedMetric} has correct callCount`)
    }
    assert.equal(unscopedMetrics.Apdex.apdexT, 0.1)
    assert.equal(unscopedMetrics['Apdex/NormalizedUri/*'].apdexT, 0.1)

    end()
  })
})

test('Otel producer span test', (t, end) => {
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
      assert.equal(segment.name, 'MessageBroker/messaging-lib/queue/Produce/Named/test-queue')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
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

test('messaging consumer metrics are bridged correctly', (t, end) => {
  const { agent, tracer } = t.nr
  const attributes = {
    [ATTR_MESSAGING_SYSTEM]: 'kafka',
    [ATTR_MESSAGING_OPERATION]: 'getMessage',
    [ATTR_SERVER_ADDRESS]: '127.0.0.1',
    [ATTR_MESSAGING_DESTINATION]: 'work-queue',
    [ATTR_MESSAGING_DESTINATION_KIND]: 'queue'
  }

  tracer.startActiveSpan('consumer-test', { kind: otel.SpanKind.CONSUMER, attributes }, (span) => {
    const tx = agent.getTransaction()
    const segment = agent.tracer.getSegment()
    span.end()
    const duration = hrTimeToMilliseconds(span.duration)
    assert.equal(duration, segment.getDurationInMillis())
    tx.end()

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

    end()
  })
})
