/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const GrpcConnection = require('../../../lib/grpc/connection')
const connectionStates = require('../../../lib/grpc/connection/states')
const NAMES = require('../../../lib/metrics/names')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const EventEmitter = require('events').EventEmitter
const util = require('util')

const grpcApi = require('../../../lib/proxy/grpc')
const protoLoader = require('@grpc/proto-loader')

const fakeTraceObserverConfig = {
  compression: true,
  trace_observer: {
    host: 'host.com',
    port: '443'
  }
}

class FakeStreamer extends EventEmitter {
  emitStatus(status) {
    this.emit('status', status)
  }
}

const createMetricAggregatorForTests = () => {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  return new MetricAggregator(
    {
      // runId: RUN_ID,
      apdexT: 0.5,
      mapper,
      normalizer
    },
    {},
    { add() {} }
  )
}

test('GrpcConnection logic tests', async (t) => {
  const metrics = createMetricAggregatorForTests()

  await t.test('test metadata generation', () => {
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    // only sets the license and run id
    const metadataFirst = connection._getMetadata('fake-license', 'fake-run-id', {}, {})
    assert.equal(metadataFirst.get('license_key').shift(), 'fake-license', 'license key set')
    assert.equal(metadataFirst.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    assert.equal(metadataFirst.get('flaky').length, 0, 'flaky not set')
    assert.equal(metadataFirst.get('delay').length, 0, 'delay not set')
    assert.equal(metadataFirst.get('flaky_code').length, 0, 'flaky_code not set')
    assert.equal(metadataFirst.get('success_delay_ms').length, 0, 'success_delay_ms not set')

    // tests that env based params get set
    const metadataSecond = connection._getMetadata(
      'fake-license',
      'fake-run-id',
      {},
      {
        NEWRELIC_GRPCCONNECTION_METADATA_FLAKY: 10,
        NEWRELIC_GRPCCONNECTION_METADATA_DELAY: 20,
        NEWRELIC_GRPCCONNECTION_METADATA_FLAKY_CODE: 7,
        NEWRELIC_GRPCCONNECTION_METADATA_SUCCESS_DELAY_MS: 400
      }
    )

    assert.equal(metadataSecond.get('license_key').shift(), 'fake-license', 'license key set')
    assert.equal(metadataSecond.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    assert.equal(metadataSecond.get('flaky').shift(), 10, 'flaky set')
    assert.equal(metadataSecond.get('delay').shift(), 20, 'delay set')
    assert.equal(metadataSecond.get('flaky_code').shift(), 7, 'flaky_code set')
    assert.equal(metadataSecond.get('success_delay_ms').shift(), 400, 'success_delay_ms set')

    // tests that env based params get set
    const metadataThird = connection._getMetadata(
      'fake-license',
      'fake-run-id',
      {},
      {
        NEWRELIC_GRPCCONNECTION_METADATA_FLAKY: 'sdfdsfsdfsdfds',
        NEWRELIC_GRPCCONNECTION_METADATA_DELAY: { foo: 'bar' },
        NEWRELIC_GRPCCONNECTION_METADATA_FLAKY_CODE: 'invalid-code',
        NEWRELIC_GRPCCONNECTION_METADATA_SUCCESS_DELAY_MS: 'w00t'
      }
    )

    assert.equal(metadataThird.get('license_key').shift(), 'fake-license', 'license key set')
    assert.equal(metadataThird.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    assert.equal(metadataThird.get('flaky').length, 0, 'flaky not set')
    assert.equal(metadataThird.get('delay').length, 0, 'delay not set')
    assert.equal(metadataFirst.get('flaky_code').length, 0, 'flaky_code not set')
    assert.equal(metadataFirst.get('success_delay_ms').length, 0, 'success_delay_ms not set')
  })

  await t.test('ensure fake enum is consistent', () => {
    for (const [key, value] of Object.entries(connectionStates)) {
      /* eslint-disable-next-line eqeqeq */
      assert.ok(key == connectionStates[value], 'found paired value for ' + key)
    }
  })

  await t.test('should apply request headers map with lowercase keys', () => {
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    const requestHeadersMap = {
      KEY_1: 'VALUE 1',
      KEY_2: 'VALUE 2'
    }

    // only sets the license and run id
    const metadata = connection._getMetadata('fake-license', 'fake-run-id', requestHeadersMap, {})

    assert.deepStrictEqual(metadata.get('key_1'), ['VALUE 1'])
    assert.deepStrictEqual(metadata.get('key_2'), ['VALUE 2'])
  })
})

test('grpc connection error handling', async (t) => {
  await t.test('should catch error when proto loader fails', (t, end) => {
    const stub = sinon.stub(protoLoader, 'loadSync').returns({})
    const connection = new GrpcConnection(fakeTraceObserverConfig)

    connection.on('disconnected', () => {
      assert.equal(connection._state, connectionStates.disconnected)
      end()
    })

    connection.connectSpans()
    stub.restore()
  })

  await t.test(
    'should catch error when loadPackageDefinition returns invalid service definition',
    (t, end) => {
      const stub = sinon.stub(grpcApi, 'loadPackageDefinition').returns({})
      const connection = new GrpcConnection(fakeTraceObserverConfig)

      connection.on('disconnected', () => {
        assert.equal(connection._state, connectionStates.disconnected)
        end()
      })

      connection.connectSpans()
      stub.restore()
    }
  )
})

test('grpc stream event handling', async (t) => {
  await t.test('should immediately reconnect with OK status', (t, end) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    metrics.getOrCreateMetric = () => {}

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    connection._reconnect = (delay) => {
      assert.ok(!delay, 'should not have delay')
      end()
    }

    const status = {
      code: grpcApi.status.OK
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()
  })

  await t.test('should disconnect, no reconnect, with UNIMPLEMENTED status', () => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    connection._reconnect = () => {
      assert.fail('should not call reconnect')
    }

    let disconnectCalled = false
    connection._disconnect = () => {
      disconnectCalled = true
    }

    const status = {
      code: grpcApi.status.UNIMPLEMENTED
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()

    assert.ok(disconnectCalled)
  })

  await t.test('should delay reconnect when status not UNPLIMENTED or OK', (t, end) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const expectedDelayMs = 5
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics, expectedDelayMs)

    connection._reconnect = (delay) => {
      assert.equal(delay, expectedDelayMs)
      end()
    }

    const statusName = 'DEADLINE_EXCEEDED'

    const status = {
      code: grpcApi.status[statusName]
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()
  })

  await t.test(
    'should default delay 15 second reconnect when status not UNPLIMENTED or OK',
    (t, end) => {
      const metrics = createMetricAggregatorForTests()
      const fakeStream = new FakeStreamer()

      const expectedDelayMs = 15 * 1000
      const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

      connection._reconnect = (delay) => {
        assert.equal(delay, expectedDelayMs)
        end()
      }

      const statusName = 'DEADLINE_EXCEEDED'

      const status = {
        code: grpcApi.status[statusName]
      }

      connection._setupSpanStreamObservers(fakeStream)

      fakeStream.emitStatus(status)

      fakeStream.removeAllListeners()
    }
  )

  await t.test('should not generate metric with OK status', () => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    let calledMetrics = false

    metrics.getOrCreateMetric = () => {
      calledMetrics = true
    }

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
    connection._reconnect = () => {}
    connection._disconnectWithoutReconnect = () => {}

    const status = {
      code: grpcApi.status.OK
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()

    assert.ok(!calledMetrics, 'grpc status OK - no metric incremented')
  })

  await t.test('should increment UNIMPLEMENTED metric on UNIMPLEMENTED status', () => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
    connection._reconnect = () => {}
    connection._disconnectWithoutReconnect = () => {}

    const status = {
      code: grpcApi.status.UNIMPLEMENTED
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()

    const metric = metrics.getOrCreateMetric(
      NAMES.INFINITE_TRACING.SPAN_RESPONSE_GRPC_UNIMPLEMENTED
    )

    assert.equal(metric.callCount, 1, 'incremented metric')
  })

  await t.test(
    'should increment SPAN_RESPONSE_GRPC_STATUS metric when status not UNPLIMENTED or OK',
    () => {
      const metrics = createMetricAggregatorForTests()
      const fakeStream = new FakeStreamer()

      const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
      connection._reconnect = () => {}
      connection._disconnectWithoutReconnect = () => {}

      const statusName = 'DEADLINE_EXCEEDED'

      const status = {
        code: grpcApi.status[statusName]
      }

      connection._setupSpanStreamObservers(fakeStream)

      fakeStream.emitStatus(status)

      fakeStream.removeAllListeners()

      const metric = metrics.getOrCreateMetric(
        util.format(NAMES.INFINITE_TRACING.SPAN_RESPONSE_GRPC_STATUS, statusName)
      )

      assert.equal(metric.callCount, 1, 'incremented metric')
    }
  )
})

test('_createClient', async (t) => {
  await t.test(
    'should create client with compression when config.infinite_tracing.compression is true',
    () => {
      const metrics = createMetricAggregatorForTests()
      const config = { ...fakeTraceObserverConfig, compression: true }
      const connection = new GrpcConnection(config, metrics)
      connection._createClient()
      const metric = metrics.getOrCreateMetric(`${NAMES.INFINITE_TRACING.COMPRESSION}/enabled`)
      assert.equal(metric.callCount, 1, 'incremented compression enabled')
      const disabledMetric = metrics.getOrCreateMetric(
        `${NAMES.INFINITE_TRACING.COMPRESSION}/disabled`
      )
      assert.notEqual(disabledMetric.callCount, null)
    }
  )

  await t.test(
    'should create client without compression when config.infinite_tracing.compression is false',
    () => {
      const metrics = createMetricAggregatorForTests()
      const config = { ...fakeTraceObserverConfig, compression: false }
      const connection = new GrpcConnection(config, metrics)
      connection._createClient()
      const metric = metrics.getOrCreateMetric(`${NAMES.INFINITE_TRACING.COMPRESSION}/disabled`)
      assert.equal(metric.callCount, 1, 'incremented compression disabled')
      const enabledMetric = metrics.getOrCreateMetric(
        `${NAMES.INFINITE_TRACING.COMPRESSION}/disabled`
      )
      assert.notEqual(enabledMetric.callCount, null)
    }
  )
})
