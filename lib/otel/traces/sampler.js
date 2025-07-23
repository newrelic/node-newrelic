/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { SamplingDecision } = require('@opentelemetry/sdk-trace-base')
const { trace, SpanKind } = require('@opentelemetry/api')

/**
 * Basic sampler that just checks if there is an active transaction.
 * If not, it falls back to checking if it is a server of consumer span
 * or `isRemote` exists on the parent span context.
 */
module.exports = class NrSampler {
  shouldSample(context, _traceId, _spanName, spanKind) {
    if (context?.transaction?.isActive()) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }

    const parentContext = trace.getSpanContext(context)
    if (parentContext?.isRemote || spanKind === SpanKind.SERVER || spanKind === SpanKind.CONSUMER) {
      return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    }

    return { decision: SamplingDecision.NOT_RECORD }
  }

  toString() {
    return 'NrSampler'
  }
}
