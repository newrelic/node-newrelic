/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { AiMonitoringSubscriber } = require('../ai-monitoring')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { LlmVectorSearch, LlmVectorSearchResult } = require('../../llm-events/langchain')
const LlmErrorMessage = require('../../llm-events/error-message')

class LangchainVectorstoreSubscriber extends AiMonitoringSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@langchain/core', channelName: 'nr_similaritySearch', trackingPrefix: LANGCHAIN.TRACKING_PREFIX, name: `${LANGCHAIN.VECTORSTORE}/similaritySearch` })
    this.events = ['asyncEnd']
  }

  /**
   * Generates a LangChainVectorSearch for entire search request.
   * Also iterates over documents in output and generates a
   * LangChainVectorSearchResult for each document.
   *
   * @param {object} params input params
   * @param {string} params.request vector search query
   * @param {number} params.k vector search top k
   * @param {object} params.output vector search documents
   * @param {TraceSegment} params.segment active segment from vector search
   * @param {Error} [params.err] if it exists, defaults to null
   * @param {Transaction} params.transaction active transaction
   */
  recordVectorSearch({
    request,
    k,
    output,
    segment,
    transaction,
    err = null
  }) {
    const { agent } = this
    const vectorSearch = new LlmVectorSearch({
      agent,
      segment,
      transaction,
      query: request,
      k,
      numDocs: output?.length,
      error: err !== null
    })

    this.recordEvent({ type: 'LlmVectorSearch', msg: vectorSearch })

    for (let sequence = 0; sequence < output.length; sequence++) {
      const document = output[sequence]
      const vectorSearchResult = new LlmVectorSearchResult({
        agent,
        segment,
        metadata: document.metadata,
        pageContent: document.pageContent,
        sequence,
        searchId: vectorSearch.id,
        transaction
      })

      this.recordEvent({
        type: 'LlmVectorSearchResult',
        msg: vectorSearchResult
      })
    }

    if (err) {
      agent.errors.add(
        transaction,
        err,
        new LlmErrorMessage({
          response: output,
          cause: err,
          vectorsearch: vectorSearch
        })
      )
    }
  }

  asyncEnd(data) {
    if (!this.enabled) {
      this.logger.debug('Langchain instrumentation is disabled, not recording Llm events.')
      return
    }
    const ctx = this.agent.tracer.getContext()
    if (ctx?.transaction?.isActive() !== true) {
      return
    }
    ctx.segment.end()

    const request = data?.arguments[0]
    const k = data?.arguments[1]
    // If we get an error, it is possible that `result = null`.
    // In that case, we define it to be an empty array.
    const { error, result = [] } = data

    this.recordVectorSearch({
      request,
      k,
      output: result,
      segment: ctx.segment,
      transaction: ctx.transaction,
      err: error
    })
  }
}

module.exports = LangchainVectorstoreSubscriber
