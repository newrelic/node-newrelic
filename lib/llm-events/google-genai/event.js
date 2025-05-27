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
    // this.request_id = response?.headers?.['x-request-id'] // TODO: what is this in Gemini?
    this.trace_id = transaction?.traceId
    this.span_id = segment?.id
    this['response.model'] = response?.modelVersion
    this['request.model'] = request?.model
    this.vendor = 'gemini'
    this.ingest_source = 'Node'
    this.metadata = agent

    // TODO: no valid response.headers found in Gemini?
    if (responseAttrs) {
      this.duration = segment?.getDurationInMillis()
      // relevant headers will be prefixed with 'x-goog'?
      // this.responseAttrs(response)
    }
  }
}
