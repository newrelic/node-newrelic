/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('../event-base')
const attachAttributes = require('./attach-attributes')

/**
 * An event that captures data about a VectorStore `similaritySearch` call in LangChain.
 *
 * An instance of `LlmVectorSearch` represents the entire search request.
 */
module.exports = class LangChainLlmVectorSearch extends LlmEvent {
  /**
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.query Vector search query
   * @param {number} params.k Vector search top k
   * @param {number} params.numDocs Number of documents in returned response
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, k, numDocs = 0, query, error }) {
    super({ agent, segment, transaction, vendor: 'langchain', error })
    this.duration = segment.getDurationInMillis()
    this['request.k'] = k
    this['response.number_of_documents'] = numDocs

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this['request.query'] = query
    }

    attachAttributes({ target: this, agent })
  }
}
