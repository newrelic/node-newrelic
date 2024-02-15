/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')
const SpanEventAggregator = require('./span-event-aggregator')
const StreamingSpanEventAggregator = require('./streaming-span-event-aggregator')
const NAMES = require('../metrics/names').INFINITE_TRACING

function createSpanEventAggregator(config, agent) {
  const traceObserver = config.infinite_tracing.trace_observer

  if (traceObserver.host) {
    traceObserver.host = traceObserver.host.trim()

    if (typeof traceObserver.port !== 'string') {
      traceObserver.port = String(traceObserver.port)
    }
    traceObserver.port = traceObserver.port.trim()

    try {
      return createStreamingAggregator(config, agent)
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
      return createStandardAggregator(config, agent)
    }
  }

  return createStandardAggregator(config, agent)
}

function createStreamingAggregator(config, agent) {
  const { metrics } = agent
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
    span_streamer: spanStreamer,
    config,
    enabled: (config) => config.distributed_tracing.enabled && config.span_events.enabled
  }

  return new StreamingSpanEventAggregator(opts, agent)
}

function createStandardAggregator(config, agent) {
  logger.trace('Creating standard span event aggregator.')

  const opts = {
    periodMs: config.event_harvest_config.report_period_ms,
    limit: config.event_harvest_config.harvest_limits.span_event_data,
    config,
    enabled: (config) => config.distributed_tracing.enabled && config.span_events.enabled
  }

  return new SpanEventAggregator(opts, agent)
}

module.exports = createSpanEventAggregator
