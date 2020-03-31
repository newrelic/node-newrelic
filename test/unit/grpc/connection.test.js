'use strict'
const tap = require('tap')

const GrpcConnection = require('../../../lib/grpc/connection')
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
  test.ok("hello")
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

  test.end()
})
