'use strict'
const tap = require('tap')
const SpanStreamer = require('../../../lib/spans/span-streamer')
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

tap.test((t)=>{
  const metrics = createMetricAggregatorForTests()
  const spanStreamer = new SpanStreamer(
    'nr-internal.aws-us-east-2.tracing.staging-edge.nr-data.net:443',
    'abc123',
    new GrpcConnection(metrics)
  )

  t.ok(spanStreamer, "instantiated the object")
  t.end()
})
