/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
module.exports = class LlmErrorkMessage {
  constructor(request, response) {
    this.api_key_last_four_digits = response?.api_key && `sk-${response.api_key.slice(-4)}`
    this['request.model'] = request.model || request.engine
    this['request.temperature'] = request.temperature
    this['request.max_tokens'] = request.max_tokens
    this.vendor = 'openAI'
    this.ingest_source = 'Node'
    this['response.number_of_messages'] = request?.messages?.length
    this['http.statusCode'] = response.status
    this['response.organization'] = response.organization
    this['error.code'] = response.code
    this['error.param'] = response.param
  }

  serialize() {
    return JSON.stringify(this, (_, v) => v || '')
  }
}
