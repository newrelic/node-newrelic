/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LangchainSubscriber = require('./base')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { LangChainVectorSearch, LangChainVectorSearchResult } = require('../../llm-events/langchain')
const LlmErrorMessage = require('../../llm-events/error-message')
const { DESTINATIONS } = require('../../config/attribute-filter')

class LangchainVectorstoreSubscriber extends LangchainSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_similaritySearch' })
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
   * @param {string} params.pkgVersion langchain version
   * @param {Error} [params.err] if it exists, defaults to null
   * @param {Transaction} params.transaction active transaction
   */
  recordVectorSearch({
    request,
    k,
    output,
    segment,
    transaction,
    pkgVersion,
    err = null
  }) {
    const { agent } = this
    const vectorSearch = new LangChainVectorSearch({
      agent,
      segment,
      transaction,
      query: request,
      k,
      documents: output,
      error: err !== null
    })

    this.recordEvent({ type: 'LlmVectorSearch', pkgVersion, msg: vectorSearch })

    for (let sequence = 0; sequence < output.length; sequence++) {
      const document = output[sequence]
      const vectorSearchResult = new LangChainVectorSearchResult({
        agent,
        segment,
        metadata: document.metadata,
        pageContent: document.pageContent,
        sequence,
        search_id: vectorSearch.id,
        transaction
      })

      this.recordEvent({
        type: 'LlmVectorSearchResult',
        pkgVersion,
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

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('Langchain instrumentation is disabled, not creating segment.')
      return ctx
    }

    const segment = this.agent.tracer.createSegment({
      name: `${LANGCHAIN.VECTORSTORE}/similaritySearch`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
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
    const { moduleVersion, error, result = [] } = data

    this.recordVectorSearch({
      request,
      k,
      output: result,
      segment: ctx.segment,
      transaction: ctx.transaction,
      pkgVersion: moduleVersion,
      err: error
    })

    ctx.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  }
}

module.exports = LangchainVectorstoreSubscriber
