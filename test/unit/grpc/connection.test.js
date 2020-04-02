'use strict'
const tap = require('tap')

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

tap.test((test) => {
  if (GrpcConnection.message === '@grpc/grpc-js only works on Node ^8.13.0 || >=10.10.0') {
    test.end()
    return
  }
  const metrics = createMetricAggregatorForTests()

  // test backoff
  test.test('tests backoff logic', (t)=>{
    const connection = new GrpcConnection(metrics, [0, 15, 15, 30, 60, 120, 300],0)
    t.equals(connection._getBackoffSeconds(), 0, 'first is 0 seconds')
    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 15, 'second is 15 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 15, 'third is 15 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 30, 'fourth is 30 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 60, 'fifth is 60 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 120, 'sixth is 120 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 300, 'seventh is 300 seconds')

    connection._incrementTries()
    t.equals(connection._getBackoffSeconds(), 300, 'eigth is also 300 seconds')

    t.end()
  })

  test.test('tests url formatting', (t) => {
    const connection = new GrpcConnection(metrics, [0, 15, 15, 30, 60, 120, 300],0)
    const fixtures = [
      {input:'http://foo.com:300/bar?science=hello',output:'foo.com:300/bar?science=hello'},
      {input:'http://foo.com:300/bar',output:'foo.com:300/bar'},
      {input:'http://foo.com:300',output:'foo.com:300'},
      {input:'http://foo.com:300/',output:'foo.com:300'},
      {input:'http://foo.com:80/',output:'foo.com:80'},
      {input:'http://foo.com:443/',output:'foo.com:443'},
      {input:'https://foo.com:80/',output:'foo.com:80'},
      {input:'https://foo.com:443/',output:'foo.com:443'},
    ]

    for (const [,fixture] of fixtures.entries()) {
      t.equals(fixture.output, connection._formatTraceObserverUrl(fixture.input))
    }

    t.end()
  })

  test.test('test metadata generation', (t) => {
    const connection = new GrpcConnection(metrics)


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
    // console.log(connectionStates)
    // t.ok(connectionStates, 'loaded connection states')
    t.end()
  })

  test.end()
})
