/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LangChainEvent = require('./event')

/**
 * @typedef {object} LangChainVectorSearchParams
 * @augments LangChainEventParams
 * @property {string} query First parameter of similaritySearch method.
 * @property {number} k Second parameter of similaritySearch method.
 * @property {object} documents The set of documents returned in a response.
 */
/**
 * @type {LangChainVectorSearchParams}
 */
const defaultParams = {
  documents: []
}

class LangChainVectorSearch extends LangChainEvent {
  duration
  'response.number_of_documents' = 0

  constructor(params) {
    params = Object.assign({}, defaultParams, params)
    super(params)
    const { agent, segment } = params

    this.duration = segment?.getDurationInMillis()
    this['request.k'] = params.k
    this['response.number_of_documents'] = params.documents?.length

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this['request.query'] = params.query
    }
  }
}

module.exports = LangChainVectorSearch
