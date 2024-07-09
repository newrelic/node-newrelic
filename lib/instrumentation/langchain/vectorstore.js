/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { LangChainVectorSearch, LangChainVectorSearchResult } = require('../../llm-events/langchain')
const { recordEvent, shouldSkipInstrumentation } = require('./common')
const { DESTINATIONS } = require('../../config/attribute-filter')
const { RecorderSpec } = require('../../shim/specs')
const LlmErrorMessage = require('../../llm-events/error-message')

/**
 * Generates a LangChainVectorSearch for entire search request.
 * Also iterates over documents in output and generates a
 * LangChainVectorSearchResult for each document.
 *
 * @param {object} params input params
 * @param {string} params.request vector search query
 * @param {number} params.k vector search top k
 * @param {object} params.output vector search documents
 * @param {Agent} params.agent NR agent instance
 * @param {Shim} params.shim current shim instance
 * @param {TraceSegment} params.segment active segment from vector search
 * @param {string} params.pkgVersion langchain version
 * @param {Error} params.err if it exists
 */
function recordVectorSearch({ request, k, output, agent, shim, segment, pkgVersion, err }) {
  const vectorSearch = new LangChainVectorSearch({
    agent,
    segment,
    query: request,
    k,
    documents: output,
    error: err !== null
  })

  recordEvent({ agent, shim, type: 'LlmVectorSearch', pkgVersion, msg: vectorSearch })

  output.forEach((document, sequence) => {
    const vectorSearchResult = new LangChainVectorSearchResult({
      agent,
      segment,
      metadata: document.metadata,
      pageContent: document.pageContent,
      sequence,
      search_id: vectorSearch.id
    })

    recordEvent({
      agent,
      shim,
      type: 'LlmVectorSearchResult',
      pkgVersion,
      msg: vectorSearchResult
    })
  })

  if (err) {
    agent.errors.add(
      segment.transaction,
      err,
      new LlmErrorMessage({
        response: output,
        cause: err,
        vectorsearch: vectorSearch
      })
    )
  }
}

module.exports = function initialize(shim, vectorstores) {
  const { agent, pkgVersion } = shim

  if (shouldSkipInstrumentation(agent.config)) {
    shim.logger.debug(
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    return
  }

  shim.record(
    vectorstores.VectorStore.prototype,
    'similaritySearch',
    function wrapCall(shim, similaritySearch, fnName, args) {
      const [request, k] = args

      return new RecorderSpec({
        name: `${LANGCHAIN.VECTORSTORE}/${fnName}`,
        promise: true,
        after({ error: err, result: output, segment }) {
          if (!output) {
            // If we get an error, it is possible that `output = null`.
            // In that case, we define it to be an empty array.
            output = []
          }

          segment.end()
          if (shouldSkipInstrumentation(shim.agent.config) === true) {
            // We need this check inside the wrapper because it is possible for monitoring
            // to be disabled at the account level. In such a case, the value is set
            // after the instrumentation has been initialized.
            shim.logger.debug('skipping sending of ai data')
            return
          }

          recordVectorSearch({ request, k, output, agent, shim, segment, pkgVersion, err })

          segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
        }
      })
    }
  )
}
