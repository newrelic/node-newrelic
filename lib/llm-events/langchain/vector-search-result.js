/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('../event-base')
const { isSimpleObject } = require('../../util/objects')

/**
 * An event that captures data about a VectorStore `similaritySearch` call in LangChain.
 *
 * An instance of `LlmVectorSearchResult` represents a single document returned by
 * the similarity search.
 */
module.exports = class LangChainLlmVectorSearchResult extends LlmEvent {
  /**
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.searchId UUID to identify the search
   * @param {number} params.sequence Index of the document in the search result documents list
   * @param {string} params.pageContent Stringified contents of the `pageContent` attribute on each returned search result document
   * @param {object} params.metadata The metadata object on each returned search result document
   */
  constructor({ agent, segment, transaction, searchId, sequence = 0, pageContent = '', metadata = {} }) {
    super({ agent, segment, transaction, vendor: 'langchain' })

    this.search_id = searchId
    this.sequence = sequence

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.page_content = pageContent
    }

    // Does not appear in AIM spec as of 2/2026, but seemed
    // to be a requirement back in 1/2024 (e.g. LangChain CDD).
    this.appName = agent.config.applications()[0]

    // `metadata.<key>` and `tags` do not appear in
    // the AIM spec, but were a requirement for the
    // initial LangChain instrumentation.
    if (isSimpleObject(metadata)) {
      this.langchainMeta = metadata
      for (const [key, val] of Object.entries(metadata)) {
        this[`metadata.${key}`] = val
      }
    }
  }
}
