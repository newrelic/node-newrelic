/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { LangChainTool } = require('../../llm-events/langchain')
const { mergeMetadata, mergeTags, recordEvent, shouldSkipInstrumentation } = require('./common')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const { langchainRunId } = require('../../symbols')
const { DESTINATIONS } = require('../../config/attribute-filter')
const { RecorderSpec } = require('../../shim/specs')
const LlmErrorMessage = require('../../llm-events/error-message')

module.exports = function initialize(shim, tools) {
  const { agent, pkgVersion } = shim

  if (shouldSkipInstrumentation(agent.config)) {
    shim.logger.debug(
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    return
  }

  shim.record(tools.StructuredTool.prototype, 'call', function wrapCall(shim, call, fnName, args) {
    const { name, metadata: instanceMeta, description, tags: instanceTags } = this
    const [request, params] = args
    const { metadata: paramsMeta, tags: paramsTags } = params || {}
    return new RecorderSpec({
      name: `${LANGCHAIN.TOOL}/${name}`,
      promise: true,
      // eslint-disable-next-line max-params
      after(_shim, _fn, _name, err, output, segment) {
        const metadata = mergeMetadata(instanceMeta, paramsMeta)
        const tags = mergeTags(instanceTags, paramsTags)
        segment.end()
        const toolEvent = new LangChainTool({
          agent,
          description,
          name,
          runId: segment[langchainRunId],
          metadata,
          tags,
          input: request?.input,
          output,
          segment,
          error: err != null
        })
        recordEvent({ agent, type: 'LlmTool', pkgVersion, msg: toolEvent })

        if (err) {
          agent.errors.add(
            segment.transaction,
            err,
            new LlmErrorMessage({
              response: {},
              cause: err,
              summary: {}
            })
          )
        }

        segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
      }
    })
  })
}
