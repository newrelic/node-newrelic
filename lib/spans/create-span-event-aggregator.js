/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const psemver = require('../util/process-version')
const logger = require('../logger')
const SpanEventAggregator = require('./span-event-aggregator')
const StreamingSpanEventAggregator = require('./streaming-span-event-aggregator')

function createSpanEventAggregator(config, collector, metrics) {
  const trace_observer = config.infinite_tracing.trace_observer

  let shouldCreateStreaming = false
  if (trace_observer.host) {
    // TODO: ideally this validation and configuration clearing would happen
    // in the config. Since we don't currently have a way to generate
    // support metrics in the config, keeping this related logic together here.
    // If logic happened prior, could merely check for existence of trace_observer.host.
    shouldCreateStreaming = validateInfiniteTracing()

    if (!shouldCreateStreaming) {
      // Explicitly disable for any downstream consumers
      trace_observer.host = ''
      trace_observer.port = ''
    }
  }

  if (shouldCreateStreaming) {
    trace_observer.host = trace_observer.host.trim()

    if (typeof trace_observer.port !== 'string') {
      trace_observer.port = String(trace_observer.port)
    }
    trace_observer.port = trace_observer.port.trim()

    return createStreamingAggregator(config, collector, metrics)
  }

  return createStandardAggregator(config, collector, metrics)
}

function createStreamingAggregator(config, collector, metrics) {
  logger.trace('Creating streaming span event aggregator for infinite tracing.')

  // loading the class here to ensure its behind a feature flag
  // and won't trigger a grpc load in node 8
  const GrpcConnection = require('../grpc/connection')
  const connection = new GrpcConnection(config.infinite_tracing.trace_observer, metrics)
  const SpanStreamer = require('./span-streamer')
  const spanStreamer = new SpanStreamer(
    config.license_key,
    connection,
    metrics,
    config.infinite_tracing.span_events.queue_size
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
  // TODO: Remove semver check when Node 10 support dropped.
  if (!psemver.satisfies('>=10.10.0')) {
    logger.warn(
      'Infinite tracing disabled: this version of Node is not supported (must be >=10.10.0)'
    )
    return false
  }

  return true
}

module.exports = createSpanEventAggregator
