'use strict'
const tap = require('tap')
const sinon = require('sinon')

const safeRequire = (id) => {
  let tmp
  try {
    tmp = require(id)
  } catch (error) {
    tmp = error
  }
  return tmp
}
const GrpcConnection = safeRequire('../../../lib/grpc/connection')
const connectionStates = require('../../../lib/grpc/connection/states')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')

const grpcApi = require('../../../lib/proxy/grpc')
const protoLoader = require('@grpc/proto-loader')

const fakeTraceObserverConfig = {
  host: 'host.com',
  port: '443'
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

const isUnsupportedNodeVersion =
  GrpcConnection.message === '@grpc/grpc-js only works on Node ^8.13.0 || >=10.10.0'

tap.test(
  'GrpcConnection logic tests',
  {skip:isUnsupportedNodeVersion},
  (test) => {
    const metrics = createMetricAggregatorForTests()

    // test backoff
    test.test('tests backoff logic', (t)=>{
      const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
      t.equals(connection._streamBackoffSeconds, 0, 'initial stream backoff is 0 seconds')
      connection._setStreamBackoffAfterInitialStreamSetup()
      t.equals(connection._streamBackoffSeconds, 15, 'future stream backoff is 15 seconds')

      const connection2 = 
        new GrpcConnection(fakeTraceObserverConfig, metrics, {initialSeconds:1, seconds:2})
      t.equals(connection2._streamBackoffSeconds, 1, 'injected initial value used')
      connection2._setStreamBackoffAfterInitialStreamSetup()
      t.equals(connection2._streamBackoffSeconds, 2, 'injected future value used')

      t.end()
    })

    test.test('test metadata generation', (t) => {
      const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)

      // only sets the license and run id
      const metadataFirst = connection._getMetadata(
        'fake-license',
        'fake-run-id',
        {}
      )
      t.equals(metadataFirst.get('license_key').shift(), 'fake-license', 'license key set')
      t.equals(metadataFirst.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
      t.equals(metadataFirst.get('flaky').length, 0, 'flaky not set')
      t.equals(metadataFirst.get('delay').length, 0, 'delay not set')

      // tests that env based params get set
      const metadataSecond = connection._getMetadata(
        'fake-license',
        'fake-run-id',
        {
          NEWRELIC_GRPCCONNECTION_METADATA_FLAKY:10,
          NEWRELIC_GRPCCONNECTION_METADATA_DELAY:20,
        }
      )
      t.equals(metadataSecond.get('license_key').shift(), 'fake-license', 'license key set')
      t.equals(metadataSecond.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
      t.equals(metadataSecond.get('flaky').shift(), 10, 'flaky set')
      t.equals(metadataSecond.get('delay').shift(), 20, 'delay set')

      // tests that env based params get set
      const metadataThird = connection._getMetadata(
        'fake-license',
        'fake-run-id',
        {
          NEWRELIC_GRPCCONNECTION_METADATA_FLAKY:'sdfdsfsdfsdfds',
          NEWRELIC_GRPCCONNECTION_METADATA_DELAY:{'foo':'bar'},
        }
      )
      t.equals(metadataThird.get('license_key').shift(), 'fake-license', 'license key set')
      t.equals(metadataThird.get('agent_run_token').shift(), 'fake-run-id', 'run id set')
      t.equals(metadataThird.get('flaky').length, 0, 'flaky not set')
      t.equals(metadataThird.get('delay').length, 0, 'delay not set')
      t.end()
    })

    test.test('ensure fake enum is consistent', (t) => {
      for (const [key, value] of Object.entries(connectionStates)) {
        /* eslint-disable-next-line eqeqeq */
        t.ok(key == connectionStates[value], 'found paired value for ' + key)
      }
      t.end()
    })

    test.end()
  }
)

tap.test('grpc connection error handling', (test) => {
  test.test('should catch error when proto loader fails', (t) => {
    const metrics = createMetricAggregatorForTests()
  
    const stub = sinon.stub(protoLoader, 'loadSync').returns({})
    
    const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
    connection.connectSpans()

    connection.on('disconnected', () => {
      t.equal(connection._state, connectionStates.disconnected)
      stub.restore()
      t.end()
    })
  })

  test.test('should catch error when loadPackageDefinition returns invalid service definition',
    (t) => {
      const metrics = createMetricAggregatorForTests()

      const stub = sinon.stub(grpcApi, 'loadPackageDefinition').returns({})

      const connection = new GrpcConnection(fakeTraceObserverConfig, metrics)
      connection.connectSpans()

      connection.on('disconnected', () => {
        t.equal(connection._state, connectionStates.disconnected)
        stub.restore()
        t.end()
      })
    })

  test.end()
})
