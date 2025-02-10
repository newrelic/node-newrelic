/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const urltils = require('../util/urltils')
const {
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_NET_PEER_NAME,
  ATTR_NET_PEER_PORT,
} = require('./constants')

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
   * @param {object} span otel span getting tested
   */
  onStart(span) {
    span[otelSynthesis] = this.synthesizer.synthesize(span)
  }

  /**
   * Update the segment duration from span and reconcile
   * any attributes that were added after the start
   * @param {object} span otel span getting updated
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment } = span[otelSynthesis]
      this.updateDuration(segment, span)
      this.reconcileAttributes(segment, span)
      delete span[otelSynthesis]
    }
  }

  updateDuration(segment, span) {
    segment.touch()
    const duration = hrTimeToMilliseconds(span.duration)
    segment.overwriteDurationInMillis(duration)
  }

  // TODO: clean this up and break out by span.kind
  reconcileAttributes(segment, span) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      let key = prop
      let sanitized = value
      if (key === ATTR_NET_PEER_PORT) {
        key = 'port_path_or_id'
      } else if (prop === ATTR_NET_PEER_NAME) {
        key = 'host'
        if (urltils.isLocalhost(sanitized)) {
          sanitized = this.agent.config.getHostnameSafe(sanitized)
        }
      } else if (prop === ATTR_DB_NAME) {
        key = 'database_name'
      } else if (prop === ATTR_DB_SYSTEM) {
        key = 'product'
      /**
       * This attribute was collected in `onStart`
       * and was passed to `ParsedStatement`. It adds
       * this segment attribute as `sql` or `sql_obfuscated`
       * and then when the span is built from segment
       * re-assigns to `db.statement`. This needs
       * to be skipped because it will be the raw value.
       */
      } else if (prop === ATTR_DB_STATEMENT) {
        continue
      }
      segment.addAttribute(key, sanitized)
    }
  }
}
