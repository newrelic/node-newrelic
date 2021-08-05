/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
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
  host: 'host.com',
  port: '443'
}

class FakeStreamer extends EventEmitter {
  constructor() {
    super()
  }

  emitStatus(status) {
    this.emit('status', status)
  }
}

const createMetricAggregatorForTests = () => {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  const metrics = new MetricAggregator(
    {
      // runId: RUN_ID,
      apdexT: 0.5,
      mapper: mapper,
      normalizer: normalizer
    },
    {}
  )
  return metrics
}

tap.test('GrpcConnection logic tests', (test) => {
  const metrics = createMetricAggregatorForTests()

  test.test('test metadata generation', (t) => {
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    // only sets the license and run id
    const metadataFirst = connection._getMetadata('fake-license', 'fake-run-id', {}, {})
    t.equal(metadataFirst.get('license_key').shift(), 'fake-license', 'license key set')
    t.equal(metadataFirst.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    t.equal(metadataFirst.get('flaky').length, 0, 'flaky not set')
    t.equal(metadataFirst.get('delay').length, 0, 'delay not set')
    t.equal(metadataFirst.get('flaky_code').length, 0, 'flaky_code not set')
    t.equal(metadataFirst.get('success_delay_ms').length, 0, 'success_delay_ms not set')

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

    t.equal(metadataSecond.get('license_key').shift(), 'fake-license', 'license key set')
    t.equal(metadataSecond.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    t.equal(metadataSecond.get('flaky').shift(), 10, 'flaky set')
    t.equal(metadataSecond.get('delay').shift(), 20, 'delay set')
    t.equal(metadataSecond.get('flaky_code').shift(), 7, 'flaky_code set')
    t.equal(metadataSecond.get('success_delay_ms').shift(), 400, 'success_delay_ms set')

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

    t.equal(metadataThird.get('license_key').shift(), 'fake-license', 'license key set')
    t.equal(metadataThird.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
    t.equal(metadataThird.get('flaky').length, 0, 'flaky not set')
    t.equal(metadataThird.get('delay').length, 0, 'delay not set')
    t.equal(metadataFirst.get('flaky_code').length, 0, 'flaky_code not set')
    t.equal(metadataFirst.get('success_delay_ms').length, 0, 'success_delay_ms not set')
    t.end()
  })

  test.test('ensure fake enum is consistent', (t) => {
    for (const [key, value] of Object.entries(connectionStates)) {
      /* eslint-disable-next-line eqeqeq */
      t.ok(key == connectionStates[value], 'found paired value for ' + key)
    }
    t.end()
  })

  test.test('should apply request headers map with lowercase keys', (t) => {
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    const requestHeadersMap = {
      KEY_1: 'VALUE 1',
      KEY_2: 'VALUE 2'
    }

    // only sets the license and run id
    const metadata = connection._getMetadata('fake-license', 'fake-run-id', requestHeadersMap, {})

    t.same(metadata.get('key_1'), ['VALUE 1'])
    t.same(metadata.get('key_2'), ['VALUE 2'])

    t.end()
  })

  test.end()
})

tap.test('grpc connection error handling', (test) => {
  test.test('should catch error when proto loader fails', (t) => {
    const stub = sinon.stub(protoLoader, 'loadSync').returns({})

    t.teardown(() => {
      stub.restore()
    })

    const connection = new GrpcConnection(fakeTraceObserverConfig)

    connection.on('disconnected', () => {
      t.equal(connection._state, connectionStates.disconnected)
      t.end()
    })

    connection.connectSpans()
  })

  test.test(
    'should catch error when loadPackageDefinition returns invalid service definition',
    (t) => {
      const stub = sinon.stub(grpcApi, 'loadPackageDefinition').returns({})
      t.teardown(() => {
        stub.restore()
      })

      const connection = new GrpcConnection(fakeTraceObserverConfig)

      connection.on('disconnected', () => {
        t.equal(connection._state, connectionStates.disconnected)

        t.end()
      })

      connection.connectSpans()
    }
  )

  test.end()
})

tap.test('grpc stream event handling', (test) => {
  test.test('should immediately reconnect with OK status', (t) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    metrics.getOrCreateMetric = () => {}

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    connection._reconnect = (delay) => {
      t.notOk(delay, 'should not have delay')
      t.end()
    }

    const status = {
      code: grpcApi.status.OK
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()
  })

  test.test('should disconnect, no reconnect, with UNIMPLEMENTED status', (t) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    connection._reconnect = () => {
      t.fail('should not call reconnect')
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

    t.ok(disconnectCalled)

    t.end()
  })

  test.test('should delay reconnect when status not UNPLIMENTED or OK', (t) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const expectedDelayMs = 5
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics, expectedDelayMs)

    connection._reconnect = (delay) => {
      t.equal(delay, expectedDelayMs)
      t.end()
    }

    const statusName = 'DEADLINE_EXCEEDED'

    const status = {
      code: grpcApi.status[statusName]
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()
  })

  test.test('should default delay 15 second reconnect when status not UNPLIMENTED or OK', (t) => {
    const metrics = createMetricAggregatorForTests()
    const fakeStream = new FakeStreamer()

    const expectedDelayMs = 15 * 1000
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

    connection._reconnect = (delay) => {
      t.equal(delay, expectedDelayMs)
      t.end()
    }

    const statusName = 'DEADLINE_EXCEEDED'

    const status = {
      code: grpcApi.status[statusName]
    }

    connection._setupSpanStreamObservers(fakeStream)

    fakeStream.emitStatus(status)

    fakeStream.removeAllListeners()
  })

  test.test('should not generate metric with OK status', (t) => {
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

    t.notOk(calledMetrics, 'grpc status OK - no metric incremented')

    t.end()
  })

  test.test('should increment UNIMPLEMENTED metric on UNIMPLEMENTED status', (t) => {
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

    t.equal(metric.callCount, 1, 'incremented metric')

    t.end()
  })

  test.test(
    'should increment SPAN_RESPONSE_GRPC_STATUS metric when status not UNPLIMENTED or OK',
    (t) => {
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

      t.equal(metric.callCount, 1, 'incremented metric')

      t.end()
    }
  )

  test.end()
})
