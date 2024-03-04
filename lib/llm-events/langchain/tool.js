/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LangChainEvent = require('./event')

class LangChainTool extends LangChainEvent {
  constructor(params) {
    super(params)
    const { agent } = params

    this.name = params.name
    this.description = params.description
    this.duration = params?.segment?.getDurationInMillis()
    this.run_id = this.request_id
    delete this.request_id
    delete this.virtual_llm
    delete this.conversation_id

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = params.input
      this.output = params.output
    }
  }
}

module.exports = LangChainTool
