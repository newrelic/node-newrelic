/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const Config = require('../../../lib/config')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')
const createSpanEventAggregator = require('../../../lib/spans/create-span-event-aggregator')
const BatchSpanStreamer = require('../../../lib/spans/batch-span-streamer')
const SpanStreamer = require('../../../lib/spans/span-streamer')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

const VALID_HOST = 'infinite-tracing.test'
const metricsStub = {
  getOrCreateMetric: sinon.stub().returns({ incrementCallCount: sinon.stub() })
}
const collectorStub = sinon.stub()
const harvesterStub = { add: sinon.stub() }
const agent = {
  collector: collectorStub,
  metrics: metricsStub,
  harvester: harvesterStub
}

test('should return standard when trace observer not configured', async () => {
  const config = Config.initialize({})

  const aggregator = createSpanEventAggregator(config, agent)
  assertStandardSpanAggregator(aggregator)
})

test('should return standard when in serverless mode, trace observer valid', async () => {
  const config = Config.initialize({
    serverless_mode: { enabled: true },
    infinite_tracing: {
      trace_observer: {
        host: VALID_HOST
      }
    }
  })

  const aggregator = createSpanEventAggregator(config, agent)
  assertStandardSpanAggregator(aggregator)
})

test('should return streaming when trace observer configured', async () => {
  const config = Config.initialize({
    infinite_tracing: {
      trace_observer: {
        host: VALID_HOST
      }
    }
  })

  const aggregator = createSpanEventAggregator(config, agent)
  const isStreamingAggregator = aggregator instanceof StreamingSpanEventAggregator

  assert.ok(isStreamingAggregator)
})

test('should create batching streamer when batching is enabled', async () => {
  metricsStub.getOrCreateMetric.resetHistory()
  const config = Config.initialize({
    infinite_tracing: {
      batching: true,
      trace_observer: {
        host: VALID_HOST
      }
    }
  })

  const aggregator = createSpanEventAggregator(config, agent)
  const isBatchStreamer = aggregator.stream instanceof BatchSpanStreamer
  assert.ok(isBatchStreamer)
  assert.ok(metricsStub.getOrCreateMetric.args[0].length === 1, 'should have only 1 metric set')
  assert.ok(
    metricsStub.getOrCreateMetric.args[0][0],
    'Supportability/InfiniteTracing/gRPC/Batching/enabled',
    'should set batching enabled supportability metric'
  )
})

test('should create span streamer when batching is disabled', async () => {
  metricsStub.getOrCreateMetric.resetHistory()
  const config = Config.initialize({
    infinite_tracing: {
      batching: false,
      trace_observer: {
        host: VALID_HOST
      }
    }
  })

  const aggregator = createSpanEventAggregator(config, agent)
  const isSpanStreamer = aggregator.stream instanceof SpanStreamer
  assert.ok(isSpanStreamer)
  assert.ok(metricsStub.getOrCreateMetric.args[0].length === 1, 'should have only 1 metric set')
  assert.ok(
    metricsStub.getOrCreateMetric.args[0][0],
    'Supportability/InfiniteTracing/gRPC/Batching/disaabled',
    'should set batching disabled supportability metric'
  )
})

test('should trim host and port options when they are strings', async () => {
  const config = Config.initialize({
    infinite_tracing: {
      trace_observer: {
        host: `   ${VALID_HOST}  `,
        port: '   300  '
      }
    }
  })

  createSpanEventAggregator(config, agent)
  assert.deepEqual(config.infinite_tracing.trace_observer, {
    host: VALID_HOST,
    port: '300'
  })
})

test('should revert to standard aggregator when it fails to create streaming aggregator', () => {
  const config = Config.initialize({
    infinite_tracing: {
      trace_observer: {
        host: VALID_HOST
      }
    }
  })

  const err = new Error('failed to craete streaming aggregator')
  const stub = sinon.stub().throws(err)
  const loggerStub = {
    warn: sinon.stub(),
    trace: sinon.stub()
  }

  const createSpanAggrStubbed = proxyquire('../../../lib/spans/create-span-event-aggregator', {
    './streaming-span-event-aggregator': stub,
    '../logger': loggerStub
  })

  const aggregator = createSpanAggrStubbed(config, agent)
  assertStandardSpanAggregator(aggregator)
  assert.deepEqual(
    config.infinite_tracing.trace_observer,
    { host: '', port: '' },
    'should set host and port to empty strings when failing to create streaming aggregator'
  )
  assert.deepEqual(
    loggerStub.warn.args[0],
    [
      err,
      'Failed to create streaming span event aggregator for infinite tracing. ' +
        'Reverting to standard span event aggregator and disabling infinite tracing'
    ],
    'should log warning about failed streaming construction'
  )
})

function assertStandardSpanAggregator(aggregator) {
  const isSpanEventAggregator = aggregator instanceof SpanEventAggregator
  const isStreamingAggregator = aggregator instanceof StreamingSpanEventAggregator

  assert.ok(isSpanEventAggregator)
  assert.ok(!isStreamingAggregator)
}
