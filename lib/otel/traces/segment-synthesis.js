/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({ component: 'segment-synthesizer' })
const normalizeTimestamp = require('../normalize-timestamp')
const { RulesEngine } = require('./rules.js')
const {
  createConsumerSegment,
  createDbSegment,
  createHttpExternalSegment,
  createInternalSegment,
  createProducerSegment,
  createServerSegment
} = require('./segments/index.js')

class SegmentSynthesizer {
  constructor(agent, { logger = defaultLogger } = {}) {
    this.agent = agent
    this.logger = logger
    this.engine = new RulesEngine()
  }

  synthesize(otelSpan) {
    const rule = this.engine.test(otelSpan)
    if (!rule?.type) {
      this.logger.debug(
        'Cannot match a rule to span name: %s, kind %s',
        otelSpan?.name,
        otelSpan?.kind
      )
      return
    }

    let mapResult
    switch (rule.type) {
      case 'consumer': {
        mapResult = createConsumerSegment(this.agent, otelSpan, rule)
        break
      }

      case 'db': {
        mapResult = createDbSegment(this.agent, otelSpan, rule)
        break
      }

      case 'external': {
        mapResult = createHttpExternalSegment(this.agent, otelSpan, rule, this.logger)
        break
      }

      case 'internal': {
        mapResult = createInternalSegment(this.agent, otelSpan, rule)
        break
      }

      case 'producer': {
        mapResult = createProducerSegment(this.agent, otelSpan, rule)
        break
      }

      case 'server': {
        mapResult = createServerSegment(this.agent, otelSpan, rule)
        break
      }

      default: {
        this.logger.debug('Found type: %s, no synthesis rule currently built', rule.type)
        return
      }
    }

    if (otelSpan.links?.length > 0) {
      // We need to map span link data over to the New Relic segment.
      // TODO: it's unclear what we should do if there are multiple links.
      const { segment } = mapResult
      segment.addAttribute('type', 'SpanLink')
      segment.addAttribute('timestamp', normalizeTimestamp(otelSpan.startTime))
      const spanContext = otelSpan.spanContext()
      segment.addAttribute('id', spanContext.spanId)
      segment.addAttribute('trace.id', spanContext.traceId)
      const link = otelSpan.links.at(0)
      segment.addAttribute('linkedSpanId', link.context.spanId)
      segment.addAttribute('linkedTraceId', link.context.traceId)
      for (const [key, value] of Object.entries(link.attributes)) {
        segment.addAttribute(key, value)
      }
    }

    return mapResult
  }
}

module.exports = SegmentSynthesizer
