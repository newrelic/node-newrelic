/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseEvent = require('../event')
const { makeId } = require('../../util/hashes')

module.exports = class LlmEvent extends BaseEvent {
  constructor({ agent, segment, request, response, responseAttrs = false, transaction }) {
    super()

    this.id = makeId(36)
    this.appName = agent.config.applications()[0]
    this.trace_id = transaction?.traceId
    this.span_id = segment?.id
    this['response.model'] = response?.modelVersion
    this['request.model'] = request?.model
    this.vendor = 'gemini'
    this.ingest_source = 'Node'
    this.metadata = agent

    if (responseAttrs) {
      this.duration = segment?.getDurationInMillis()
    }
  }

  getUsageTokens(response) {
    const promptTokens = Number(response?.usageMetadata?.promptTokenCount)
    const completionTokens = Number(response?.usageMetadata?.candidatesTokenCount)
    const totalTokens = Number(response?.usageMetadata?.totalTokenCount)
    return { promptTokens, completionTokens, totalTokens }
  }
}
