/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
const { usageTokens } = require('./utils')

class LlmEmbedding extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false, transaction }) {
    super({ agent, segment, request, response, responseAttrs: true, transaction })
    this.error = withError

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = request.contents?.toString()
    }

    // TODO: only call this when record_content is enabled?
    usageTokens(response, this)
  }
}

module.exports = LlmEmbedding
