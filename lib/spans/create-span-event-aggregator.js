'use strict'

const psemver = require('../util/process-version')
const logger = require('../logger')
const SpanEventAggregator = require('./span-event-aggregator')
const StreamingSpanEventAggregator = require('./streaming-span-event-aggregator')

function createSpanEventAggregator(config, collector, metrics) {
  let shouldCreateStreaming = false
  if (config.feature_flag.infinite_tracing 
      && config.infinite_tracing.trace_observer.host
      && config.infinite_tracing.trace_observer.port) {
    // TODO: ideally this validation and configuration clearing would happen
    // in the config. Since we don't currently have a way to generate
    // support metrics in the config, keeping this related logic together here.
    // If logic happened prior, could merely check for existance of trace_observer.host.
    shouldCreateStreaming = validateInfiniteTracing()

    if (!shouldCreateStreaming) {
      // Explicitly disable for any downstream consumers
      config.infinite_tracing.trace_observer.host = ''
      config.infinite_tracing.trace_observer.port = ''
    }
  }

  if (shouldCreateStreaming) {
    return createStreamingAggregator(config, collector, metrics)
  }

  return createStandardAggregator(config, collector, metrics)
}

function createStreamingAggregator(config, collector, metrics) {
  logger.trace('Creating streaming span event aggregator for infinite tracing.')

  // loading the class here to ensure its behind a feature flag
  // and won't trigger a grpc load in node 8
  const GrpcConnection = require('../grpc/connection')
  const connection = new GrpcConnection(metrics)
  const SpanStreamer = require('./span-streamer')
  const spanStreamer = new SpanStreamer(
    getTraceObserverEndpoint(config),
    config.license_key,
    connection
  )

  const opts = {
    periodMs: 1000,
    limit: 50000,
    span_streamer: spanStreamer
  }

  const aggregator = new StreamingSpanEventAggregator(opts, collector, metrics)

  return aggregator
}

function createStandardAggregator(config, collector, metrics) {
  logger.trace('Creating standard span event aggregator.')

  const opts = {
    periodMs: config.event_harvest_config.report_period_ms,
    limit: config.event_harvest_config.harvest_limits.span_event_data
  }

  const aggregator = new SpanEventAggregator(opts, collector, metrics)
  return aggregator
}

function validateInfiniteTracing() {
  if (!psemver.satisfies('>=10.10.0')) {
    logger.warn(
      'Infinite tracing disabled: this version of Node is not supported (must be >=10.10.0)'
    )

    return false
  }

  return true
}

function getTraceObserverEndpoint(config) {
  /* eslint-disable-next-line */
  return `${config.infinite_tracing.trace_observer.host.trim()}:${config.infinite_tracing.trace_observer.port.trim()}`
}

module.exports = createSpanEventAggregator
