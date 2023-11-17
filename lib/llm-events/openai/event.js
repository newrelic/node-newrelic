/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../../util/hashes')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

module.exports = class LlmEvent {
  constructor({ agent, segment, request, response, responseAttrs = false }) {
    this.id = makeId(36)
    this.appName = agent.config.applications()[0]
    this.request_id = response?.headers?.['x-request-id']
    this.trace_id = segment?.transaction?.traceId
    this.span_id = segment?.id
    this.transaction_id = segment?.transaction?.id
    this['response.model'] = response.model
    this.vendor = 'openAI'
    this.ingest_source = 'Node'

    /**
     * Used in embedding, and chat completion summary.
     * The flag will include response attributes but also
     * other attributes from request like model, and api key.
     * Lastly, it includes the active span's duration.
     */
    if (responseAttrs) {
      this['request.model'] = request.model || request.engine
      this.duration = segment?.getDurationInMillis()
      this.api_key_last_four_digits = response?.api_key && `sk-${response.api_key.slice(-4)}`
      this.responseAttrs(response)
    }
  }

  responseAttrs(response) {
    this['response.organization'] = response?.headers?.['openai-organization']
    this['response.usage.total_tokens'] = response?.usage?.total_tokens
    this['response.usage.prompt_tokens'] = response?.usage?.prompt_tokens
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

  conversationId(agent) {
    const transaction = agent.tracer.getTransaction()
    const attrs = transaction?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE)
    return attrs?.conversation_id
  }
}
