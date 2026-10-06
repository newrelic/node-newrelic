/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { SamplingDecision } = require('#agentlib/otel/constants.js')

function makeProcessor() {
  const calls = { onStart: [], onEnd: [] }
  return {
    calls,
    onStart(span) { calls.onStart.push(span) },
    onEnd(span) { calls.onEnd.push(span) }
  }
}

function makeSampler(decision = SamplingDecision.RECORD_AND_SAMPLED) {
  return { shouldSample: () => { return { decision } } }
}

module.exports = {
  makeProcessor,
  makeSampler
}
