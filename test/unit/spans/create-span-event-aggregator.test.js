'use strict'

const tap = require('tap')
const semver = require('semver')

const Config = require('../../../lib/config')
const SpanEventAggregator = require('../../../lib/spans/span-event-aggregator')
const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')
const createSpanEventAggregator = require('../../../lib/spans/create-span-event-aggregator')

const NAMES = require('../../../lib/metrics/names')

const VALID_URL = 'https://infinite_tracing.test:443'
const INVALID_URL = '//infinite_tracing.test:443'

const isGrpcSupportedVersion = semver.satisfies(process.version, '>=10.10.0')

tap.test('should return standard when infinite feature flag disabled', (t) => {
  const config = Config.initialize({
    feature_flag: {
      infinite_tracing: false
    }
  })

  const aggregator = createSpanEventAggregator(config)
  assertStandardSpanAggregator(t, aggregator)

  t.end()
})

tap.test('should return standard when trace observer not configured', (t) => {
  const config = Config.initialize({
    feature_flag: {
      infinite_tracing: true
    }
  })

  const aggregator = createSpanEventAggregator(config)
  assertStandardSpanAggregator(t, aggregator)

  t.end()
})

tap.test(
  'should return standard when trace observer not valid',
  {skip: !isGrpcSupportedVersion},
  (t) => {
    const stubbedMetrics = createMetricAggregatorStub()

    const config = Config.initialize({
      feature_flag: {
        infinite_tracing: true
      },
      infinite_tracing: { trace_observer_url: INVALID_URL }
    })

    const aggregator = createSpanEventAggregator(config, null, stubbedMetrics)
    assertStandardSpanAggregator(t, aggregator)

    t.end()
  }
)

tap.test(
  'should reset/disable trace observer when trace observer not valid',
  {skip: !isGrpcSupportedVersion},
  (t) => {
    const stubbedMetrics = createMetricAggregatorStub()

    const config = Config.initialize({
      feature_flag: {
        infinite_tracing: true
      },
      infinite_tracing: { trace_observer_url: INVALID_URL }
    })

    createSpanEventAggregator(config, null, stubbedMetrics)
    t.equal(config.infinite_tracing.trace_observer_url, '')

    t.end()
  }
)

tap.test(
  'should generate malformed support metric when trace observer not valid',
  {skip: !isGrpcSupportedVersion},
  (t) => {
    const config = Config.initialize({
      feature_flag: {
        infinite_tracing: true
      },
      infinite_tracing: { trace_observer_url: INVALID_URL }
    })

    const stubbedMetrics = createMetricAggregatorStub((incrementedMetricName) => {
      t.equal(incrementedMetricName, NAMES.INFINITE_TRACING.MALFORMED_TRACE_OBSERVER)

      t.end()
    })

    createSpanEventAggregator(config, null, stubbedMetrics)
  }
)

tap.test(
  'should return standard when in serverless mode, trace observer valid',
  {skip: !isGrpcSupportedVersion},
  (t) => {
    const config = Config.initialize({
      feature_flag: {
        infinite_tracing: true
      },
      serverless_mode: { enabled: true },
      infinite_tracing: { trace_observer_url: VALID_URL }
    })

    const aggregator = createSpanEventAggregator(config)
    assertStandardSpanAggregator(t, aggregator)

    t.end()
  }
)

tap.test('should return standard aggregator when node version < gprc minimum', (t) => {
  tempOverrideNodeVersion(t, 'v10.0.0')

  const config = Config.initialize({
    feature_flag: {
      infinite_tracing: true
    },
    infinite_tracing: { trace_observer_url: VALID_URL }
  })

  const aggregator = createSpanEventAggregator(config)
  assertStandardSpanAggregator(t, aggregator)

  t.end()
})

tap.test('should reset/disable trace observer when node version < gprc minimum', (t) => {
  tempOverrideNodeVersion(t, 'v10.0.0')

  const config = Config.initialize({
    feature_flag: {
      infinite_tracing: true
    },
    infinite_tracing: { trace_observer_url: VALID_URL }
  })

  createSpanEventAggregator(config)
  t.equal(config.infinite_tracing.trace_observer_url, '')

  t.end()
})


tap.test(
  'should return streaming when trace observer configured',
  {skip: !isGrpcSupportedVersion},
  (t) => {
    const config = Config.initialize({
      feature_flag: {
        infinite_tracing: true
      },
      infinite_tracing: { trace_observer_url: VALID_URL }
    })

    const aggregator = createSpanEventAggregator(config)
    const isStreamingAggregator = aggregator instanceof StreamingSpanEventAggregator

    t.ok(isStreamingAggregator)

    t.end()
  }
)

function tempOverrideNodeVersion(t, newVersion) {
  const originalVersion = process.version
  Object.defineProperty(process, 'version', {value: newVersion, writable: true})
  t.teardown(() => {
    process.version = originalVersion
  })
}

function assertStandardSpanAggregator(t, aggregator) {
  const isSpanEventAggregator = aggregator instanceof SpanEventAggregator
  const isStreamingAggregator = aggregator instanceof StreamingSpanEventAggregator

  t.ok(isSpanEventAggregator)
  t.notOk(isStreamingAggregator)
}

function createMetricAggregatorStub(onMetricIncremented) {
  const stubbedMetricAggregator = {
    getOrCreateMetric: (name) => {
      return {
        incrementCallCount: () => {
          if (onMetricIncremented) {
            onMetricIncremented(name)
          }
        }
      }
    }
  }

  return stubbedMetricAggregator
}
