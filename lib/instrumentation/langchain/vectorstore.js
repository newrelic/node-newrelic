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
      const [request, params] = args

      return new RecorderSpec({
        name: `${LANGCHAIN.VECTORSTORE}/${fnName}`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, _err, output, segment) {
          segment.end()
          const vectorSearch = new LangChainVectorSearch({
            agent,
            segment,
            query: request,
            k: params,
            documents: output
          })

          recordEvent({ agent, type: 'LlmVectorSearch', pkgVersion, msg: vectorSearch })

          output.forEach((document, sequence) => {
            const vectorSearchResult = new LangChainVectorSearchResult({
              agent,
              segment,
              metadata: document.metadata,
              pageContent: document.pageContent,
              sequence
            })

            recordEvent({
              agent,
              type: 'LlmVectorSearchResult',
              pkgVersion,
              msg: vectorSearchResult
            })
          })
          segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
        }
      })
    }
  )
}
