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
  let shouldCreateStreaming = false
  if (config.infinite_tracing.trace_observer.host) {
    // TODO: ideally this validation and configuration clearing would happen
    // in the config. Since we don't currently have a way to generate
    // support metrics in the config, keeping this related logic together here.
    // If logic happened prior, could merely check for existence of trace_observer.host.
    shouldCreateStreaming = validateInfiniteTracing(config.infinite_tracing.trace_observer)

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

function validateInfiniteTracing(trace_observer) {
  if (!psemver.satisfies('>=10.10.0')) {
    logger.warn(
      'Infinite tracing disabled: this version of Node is not supported (must be >=10.10.0)'
    )
    return false
  }

  trace_observer.host = trace_observer.host.trim()

  if (!validateHostName(trace_observer.host)) {
    logger.warn('Infinite tracing disabled: invalid infinite_tracing.trace_observer.host value')

    return false
  }

  if (typeof trace_observer.port !== 'string') {
    trace_observer.port = String(trace_observer.port)
  }

  trace_observer.port = trace_observer.port.trim()

  if (!validatePortValue(trace_observer.port)) {
    logger.warn('Infinite tracing disabled: invalid infinite_tracing.trace_observer.port value')

    return false
  }

  return true
}

function validateHostName(host) {
  // Regular expression for validating a hostname
  const hostReg = /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/

  return hostReg.test(host)
}

function validatePortValue(port) {
  if (port.length === 0) return false

  return !isNaN(port)
}

module.exports = createSpanEventAggregator
