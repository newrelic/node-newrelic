/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')

class LlmEmbedding extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false, transaction }) {
    super({ agent, segment, request, response, responseAttrs: true, transaction })
    this.error = withError

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = request.contents?.toString()
    }
    this.token_count = agent.llm?.tokenCountCallback?.(
      this['request.model'],
      request.contents?.toString()
    )
  }
}

module.exports = LlmEmbedding
