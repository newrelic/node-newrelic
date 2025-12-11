/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const { langchainRunId } = require('../../symbols')

class LangchainCallbackManagerSubscriber extends LangchainSubscriber {
  constructor({ agent, logger, channelName = 'nr_handleToolStart' }) {
    super({ agent, logger, channelName })
  }

  asyncEnd(data) {
    const { result } = data
    const ctx = this.agent.tracer.getContext()
    const { segment } = ctx
    if (segment) {
      segment[langchainRunId] = result?.runId
    }
  }
}

module.exports = LangchainCallbackManagerSubscriber
