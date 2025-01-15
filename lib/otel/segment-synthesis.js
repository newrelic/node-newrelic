/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { RulesEngine } = require('./rules')
const defaultLogger = require('../logger').child({ component: 'segment-synthesizer' })
const {
  createConsumerSegment,
  createDbSegment,
  createHttpExternalSegment,
  createInternalSegment,
  createProducerSegment,
  createServerSegment
} = require('./segments')

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
        return createConsumerSegment(this.agent, otelSpan)
      }

      case 'db': {
        return createDbSegment(this.agent, otelSpan)
      }

      case 'external': {
        return createHttpExternalSegment(this.agent, otelSpan)
      }

      case 'internal': {
        return createInternalSegment(this.agent, otelSpan)
      }

      case 'producer': {
        return createProducerSegment(this.agent, otelSpan)
      }

      case 'server': {
        return createServerSegment(this.agent, otelSpan)
      }

      default: {
        this.logger.debug('Found type: %s, no synthesis rule currently built', rule.type)
      }
    }
  }
}

module.exports = SegmentSynthesizer
