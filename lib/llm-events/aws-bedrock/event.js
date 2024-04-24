/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { randomUUID } = require('crypto')
const { DESTINATIONS } = require('../../config/attribute-filter')

/**
 * @typedef {object} LlmEventParams
 * @property {object} agent A New Relic agent instance.
 * @property {BedrockCommand} bedrockCommand A parsed invoke command.
 * @property {BedrockResponse} bedrockResponse A parsed response from the API.
 * @property {object} segment The current segment for the trace.
 */
/**
 * @type {LlmEventParams}
 */
const defaultParams = {
  agent: {},
  bedrockCommand: {},
  bedrockResponse: {},
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

    const { agent, bedrockCommand, bedrockResponse, segment } = params
    this.bedrockCommand = bedrockCommand
    this.bedrockResponse = bedrockResponse

    this.id = randomUUID()
    this.vendor = 'bedrock'
    this.ingest_source = 'Node'
    this.appName = agent.config.applications()[0]
    this.span_id = segment.id
    this.trace_id = segment.transaction.traceId
    this.request_id = this.bedrockResponse.requestId
    this.metadata = agent

    this['response.model'] = this.bedrockCommand.modelId
    this['request.model'] = this.bedrockCommand.modelId
    this['request.max_tokens'] = null
  }

  /**
   * Pull user set `llm.*` attributes from the current transaction and
   * add them to the event.
   *
   * @param {object} agent The New Relic agent that provides access to the
   * transaction.
   */
  set metadata(agent) {
    const tx = agent.tracer.getTransaction()
    const attrs = tx?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE) || {}
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('llm.') === false) {
        continue
      }
      this[k] = v
    }
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
