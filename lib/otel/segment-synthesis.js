/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { RulesEngine } = require('./rules')
const defaultLogger = require('../logger').child({ component: 'segment-synthesizer' })
const NAMES = require('../metrics/names')
const { SEMATTRS_HTTP_HOST } = require('@opentelemetry/semantic-conventions')

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

    if (rule?.type === 'external') {
      return this.createExternalSegment(otelSpan)
    }
    this.logger.debug('Found type: %s, no synthesize rule currently built', rule.type)
  }

  // TODO: should we move these to somewhere else and use in the places
  // where external segments are created in our agent
  createExternalSegment(otelSpan) {
    const context = this.agent.tracer.getContext()
    const host = otelSpan.attributes[SEMATTRS_HTTP_HOST] || 'Unknown'
    const name = NAMES.EXTERNAL.PREFIX + host
    return this.agent.tracer.createSegment({
      name,
      parent: context.segment,
      transaction: context.transaction
    })
  }
}

module.exports = SegmentSynthesizer
