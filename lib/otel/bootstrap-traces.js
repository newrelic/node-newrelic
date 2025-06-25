/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = bootstrapTraces

const opentelemetry = require('@opentelemetry/api')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { KnexInstrumentation } = require('@opentelemetry/instrumentation-knex')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')

const NrSpanProcessor = require('./span-processor')
const NrSampler = require('./sampler')
const ContextManager = require('./context-manager')
const TracePropagator = require('./trace-propagator')
const createOtelLogger = require('./logger')
const interceptSpanKey = require('./span-key-interceptor')

function bootstrapTraces(agent, logger) {
  createOtelLogger(logger, agent.config)

  opentelemetry.trace.setGlobalTracerProvider(new BasicTracerProvider({
    sampler: new NrSampler(),
    spanProcessors: [new NrSpanProcessor(agent)],
    generalLimits: {
      attributeValueLengthLimit: 4095
    }
  }))

  interceptSpanKey(agent)
  opentelemetry.context.setGlobalContextManager(new ContextManager(agent))
  opentelemetry.propagation.setGlobalPropagator(new TracePropagator(agent))

  registerInstrumentations({
    instrumentations: [
      new KnexInstrumentation({ maxQueryLength: -1, requireParentSpan: true })
    ]
  })

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Traces')
    .incrementCallCount()
}
