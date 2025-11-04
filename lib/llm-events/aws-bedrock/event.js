/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { randomUUID } = require('crypto')
const BaseEvent = require('../event')

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
  transaction: {},
  segment: {}
}

/**
 * Baseline object representing a LLM event.
 */
class LlmEvent extends BaseEvent {
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
    super()
    params = Object.assign({}, defaultParams, params)
    this.constructionParams = params

    const { agent, bedrockCommand, bedrockResponse, segment, transaction } = params
    this.bedrockCommand = bedrockCommand
    this.bedrockResponse = bedrockResponse

    this.id = randomUUID()
    this.vendor = 'bedrock'
    this.ingest_source = 'Node'
    this.appName = agent.config.applications()[0]
    this.span_id = segment.id
    this.trace_id = transaction.traceId
    this.request_id = this.bedrockResponse.requestId
    this.metadata = agent

    this['response.model'] = this.bedrockCommand.modelId
    this['request.model'] = this.bedrockCommand.modelId
    this['request.max_tokens'] = null
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
