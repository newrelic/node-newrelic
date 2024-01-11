/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { randomUUID } = require('crypto')

/**
 * @typedef {object} LlmEventParams
 * @property {object} agent A New Relic agent instance.
 * @property {BedrockCommand} bedrockCommand A parsed invoke command.
 * @property {BedrockResponse} bedrockResponse A parsed response from the API.
 * @property {object} credentials An object representing the credentials that
 * will be used by the AWS client. This should match the result of
 * `await client.credentials()`.
 * @property {object} segment The current segment for the trace.
 */
/**
 * @type {LlmEventParams}
 */
const defaultParams = {
  agent: {},
  bedrockCommand: {},
  bedrockResponse: {},
  credentials: {
    accessKeyId: ''
  },
  segment: {
    transaction: {}
  }
}

/**
 * Baseline object representing a LLM event.
 */
class LlmEvent {
  /**
   * All parameters that were passed in to the constructor after they have
   * been merged with the constructor's defaults.
   */
  constructionParams

  bedrockCommand
  bedrockResponse

  /**
   * @param {LlmEventParams} params Construction parameters.
   */
  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    this.constructionParams = params

    const { agent, bedrockCommand, bedrockResponse, credentials, segment } = params
    this.bedrockCommand = bedrockCommand
    this.bedrockResponse = bedrockResponse

    this.id = randomUUID()
    this.vendor = 'bedrock'
    this.ingest_source = 'Node'
    this.appName = agent.config.applications()[0]
    this.api_key_last_four_digits = credentials?.accessKeyId.slice(-4)
    this.span_id = segment.id
    this.transaction_id = segment.transaction.id
    this.trace_id = segment.transaction.traceId
    this.request_id = this.bedrockResponse.requestId

    this['response.model'] = this.bedrockCommand.modelId
    this['request.model'] = this.bedrockCommand.modelId
    this['request.max_tokens'] = null
  }

  /**
   * Retrieve the conversation identifier from the custom attributes
   * stored in the current transaction.
   *
   * @param {object} agent The New Relic agent that provides access to the
   * transaction.
   *
   * @returns {string}
   */
  conversationId(agent) {
    const tx = agent.tracer.getTransaction()
    // This magic number is brought to you by:
    // https://github.com/newrelic/node-newrelic/blob/10762a7/lib/config/attribute-filter.js#L10-L23
    // We hard code it here because we'd have a cyclic dependency if we tried
    // to import it from `newrelic` (`newrelic` uses this module to provide
    // the AWS instrumentation).
    const attrs = tx?.trace?.custom.get(0x01 | 0x02 | 0x04 | 0x08)
    return attrs?.['llm.conversation_id']
  }

  /**
   * Removes the complex objects from the event
   * This will be called right before the event is enqueued to the custom event aggregator
   */
  serialize() {
    delete this.bedrockCommand
    delete this.bedrockResponse
    delete this.constructionParams
  }
}

module.exports = LlmEvent
