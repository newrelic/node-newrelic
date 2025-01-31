/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')

module.exports = class NrSpanProcessor {
  constructor(agent) {
    this.agent = agent
    this.synthesizer = new SegmentSynthesizer(agent)
    this.tracer = agent.tracer
  }

  /**
   * Synthesize segment at start of span and assign to a symbol
   * that will be removed in `onEnd` once the correspondig
   * segment is read.
   * @param span
   */
  onStart(span) {
    span[otelSynthesis] = this.synthesizer.synthesize(span)
  }

  /**
   * Update the segment duration from span and reconcile
   * any attributes that were added after the start
   * @param span
   */
  onEnd(span) {
    this.updateDuration(span)
    // TODO: add attributes from span that did not exist at start
  }

  updateDuration(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment } = span[otelSynthesis]
      segment.touch()
      const duration = hrTimeToMilliseconds(span.duration)
      segment.overwriteDurationInMillis(duration)
      delete span[otelSynthesis]
    }
  }
}
