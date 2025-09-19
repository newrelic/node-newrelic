/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')

const defaultLogger = require('../../logger').child({ component: 'opentelemetry-traces' })
const SetupSignal = require('../setup-signal.js')
const NrSampler = require('./sampler.js')
const NrSpanProcessor = require('./span-processor.js')

class SetupTraces extends SetupSignal {
  constructor({ agent, logger = defaultLogger } = {}) {
    super({ agent, logger })

    const sampler = new NrSampler()
    const spanProcessor = new NrSpanProcessor(agent)
    const traceProvider = new BasicTracerProvider({
      sampler,
      spanProcessors: [spanProcessor],
      generalLimits: {
        attributeValueLengthLimit: 4_095
      }
    })
    this.coreApi.trace.setGlobalTracerProvider(traceProvider)

    agent.metrics
      .getOrCreateMetric('Supportability/Tracing/Nodejs/OpenTelemetryBridge/enabled')
      .incrementCallCount()
  }

  teardown() {
    this.coreApi.trace.disable()
  }
}

module.exports = SetupTraces
