/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const OpenAISubscriber = require('./base')
class OpenAIClientSubscriber extends OpenAISubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_makeRequest' })
  }

  handler(data, ctx) {
    const { self } = data
    ctx.extras = { apiKey: self.apiKey }
    return ctx
  }

  asyncEnd(data) {
    const { result } = data
    const ctx = this.agent.tracer.getContext()
    if (ctx?.segment) {
      const headers = result?.response?.headers
        ? Object.fromEntries(result.response.headers)
        : { ...result?.headers }
      ctx.extras = { headers }
    }
  }
}

module.exports = OpenAIClientSubscriber
