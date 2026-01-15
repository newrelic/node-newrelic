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
    const { result, error } = data
    const ctx = this.agent.tracer.getContext()
    if (ctx?.segment) {
      const responseHeaders = result?.response?.headers
      let headers = {}
      if (responseHeaders) {
        headers = Object.fromEntries(responseHeaders)
      } else if (error?.headers) {
        // In openai v5 they made error headers consistent with response headers
        // they are now some custom class that can retrieve headers via `Object.fromEntries`
        headers = error?.headers?.values ? Object.fromEntries(error.headers) : { ...error.headers }
      }
      ctx.extras = { headers }
    }
  }
}

module.exports = OpenAIClientSubscriber
