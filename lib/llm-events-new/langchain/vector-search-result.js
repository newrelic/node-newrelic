/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmEvent = require('../base')
const { isSimpleObject } = require('../../util/objects')

/**
 * An event that captures data about a VectorStore `similaritySearch` call in LangChain.
 *
 * An instance of `LlmVectorSearchResult` represents a single document returned by
 * the similarity search.
 */
class LangChainLlmVectorSearchResult extends LlmEvent {
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

    // TODO: Does not appear in AIM spec, but was a
    // requirement for LangChain instrumentation back in 2024?
    this.appName = agent.config.applications()[0]
    this.langchainMeta = metadata
  }

  // eslint-disable-next-line accessor-pairs
  set langchainMeta(value) {
    if (isSimpleObject(value) === false) {
      return
    }
    for (const [key, val] of Object.entries(value)) {
      this[`metadata.${key}`] = val
    }
  }
}

module.exports = LangChainLlmVectorSearchResult
