/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({ component: 'segment-synthesizer' })
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

    switch (rule.type) {
      case 'consumer': {
        return createConsumerSegment(this.agent, otelSpan, rule)
      }

      case 'db': {
        return createDbSegment(this.agent, otelSpan, rule)
      }

      case 'external': {
        return createHttpExternalSegment(this.agent, otelSpan, rule, this.logger)
      }

      case 'internal': {
        return createInternalSegment(this.agent, otelSpan, rule)
      }

      case 'producer': {
        return createProducerSegment(this.agent, otelSpan, rule)
      }

      case 'server': {
        return createServerSegment(this.agent, otelSpan, rule)
      }

      default: {
        this.logger.debug('Found type: %s, no synthesis rule currently built', rule.type)
      }
    }
  }
}

module.exports = SegmentSynthesizer
