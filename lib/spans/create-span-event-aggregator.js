/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')
const SpanEventAggregator = require('./span-event-aggregator')
const StreamingSpanEventAggregator = require('./streaming-span-event-aggregator')
const NAMES = require('../metrics/names').INFINITE_TRACING

function createSpanEventAggregator(config, collector, metrics) {
  const traceObserver = config.infinite_tracing.trace_observer

  if (traceObserver.host) {
    traceObserver.host = traceObserver.host.trim()

    if (typeof traceObserver.port !== 'string') {
      traceObserver.port = String(traceObserver.port)
    }
    traceObserver.port = traceObserver.port.trim()

    try {
      return createStreamingAggregator(config, collector, metrics)
    } catch (err) {
      logger.warn(
        err,
        'Failed to create streaming span event aggregator for infinite tracing. ' +
          'Reverting to standard span event aggregator and disabling infinite tracing'
      )
      config.infinite_tracing.trace_observer = {
        host: '',
        port: ''
      }
      return createStandardAggregator(config, collector, metrics)
    }
  }

  return createStandardAggregator(config, collector, metrics)
}

function createStreamingAggregator(config, collector, metrics) {
  logger.trace('Creating streaming span event aggregator for infinite tracing.')
  const GrpcConnection = require('../grpc/connection')

  const connection = new GrpcConnection(config.infinite_tracing, metrics)
  let spanStreamer

  if (config.infinite_tracing.batching) {
    const BatchSpanStreamer = require('./batch-span-streamer')
    spanStreamer = new BatchSpanStreamer(
      config.license_key,
      connection,
      metrics,
      config.infinite_tracing.span_events.queue_size
    )
    metrics.getOrCreateMetric(`${NAMES.BATCHING}/enabled`).incrementCallCount()
  } else {
    const SpanStreamer = require('./span-streamer')
    spanStreamer = new SpanStreamer(
      config.license_key,
      connection,
      metrics,
      config.infinite_tracing.span_events.queue_size
    )
    metrics.getOrCreateMetric(`${NAMES.BATCHING}/disabled`).incrementCallCount()
  }

  // this periodMs has no affect on gRPC calls
  // the send method on StreamingSpanEventAggregator is a no-op
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
