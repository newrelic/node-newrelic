/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')
const SpanEventAggregator = require('./span-event-aggregator')
const StreamingSpanEventAggregator = require('./streaming-span-event-aggregator')
const GrpcConnection = require('../grpc/connection')
const SpanStreamer = require('./span-streamer')

function createSpanEventAggregator(config, collector, metrics) {
  const trace_observer = config.infinite_tracing.trace_observer

  if (trace_observer.host) {
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

  const connection = new GrpcConnection(config.infinite_tracing.trace_observer, metrics)
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

  return new StreamingSpanEventAggregator(opts, collector, metrics)
}

function createStandardAggregator(config, collector, metrics) {
  logger.trace('Creating standard span event aggregator.')

  const opts = {
    periodMs: config.event_harvest_config.report_period_ms,
    limit: config.event_harvest_config.harvest_limits.span_event_data
  }

  return new SpanEventAggregator(opts, collector, metrics)
}

module.exports = createSpanEventAggregator
