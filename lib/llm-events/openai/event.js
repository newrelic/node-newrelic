/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
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
    this.request_id = response?.headers?.['x-request-id']
    this.trace_id = transaction?.traceId
    this.span_id = segment?.id
    this['response.model'] = response.model
    this.vendor = 'openai'
    this.ingest_source = 'Node'
    this.metadata = agent

    /**
     * Used in embedding, and chat completion summary.
     * The flag will include response attributes but also
     * other attributes from request like model, and api key.
     * Lastly, it includes the active span's duration.
     */
    if (responseAttrs) {
      this['request.model'] = request.model || request.engine
      this.duration = segment?.getDurationInMillis()
      this.responseAttrs(response)
    }
  }

  responseAttrs(response) {
    this['response.organization'] = response?.headers?.['openai-organization']
    this['response.headers.llmVersion'] = response?.headers?.['openai-version']
    this['response.headers.ratelimitLimitRequests'] =
      response?.headers?.['x-ratelimit-limit-requests']
    this['response.headers.ratelimitLimitTokens'] = response?.headers?.['x-ratelimit-limit-tokens']
    this['response.headers.ratelimitResetTokens'] = response?.headers?.['x-ratelimit-reset-tokens']
    this['response.headers.ratelimitRemainingTokens'] =
      response?.headers?.['x-ratelimit-remaining-tokens']
    this['response.headers.ratelimitRemainingRequests'] =
      response?.headers?.['x-ratelimit-remaining-requests']
  }

  getUsageTokens(response) {
    const promptTokens = Number(response?.usage?.prompt_tokens || response?.usage?.input_tokens)
    const completionTokens = Number(response?.usage?.completion_tokens || response?.usage?.output_tokens)
    const totalTokens = Number(response?.usage?.total_tokens || response?.usage?.totalTokens)
    return { promptTokens, completionTokens, totalTokens }
  }
}
