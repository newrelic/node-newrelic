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
    if (!shim.isWrapped(this, '_call')) {
      shim.wrap(this, '_call', wrapUnderCall)
    }

    const [request, params] = args
    const { metadata: paramsMeta, tags: paramsTags } = params || {}
    return {
      name: `${LANGCHAIN.TOOL}/${name}`,
      promise: true,
      // eslint-disable-next-line max-params
      after(_shim, _fn, _name, _err, output, segment) {
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
          segment
        })
        recordEvent({ agent, type: 'LlmTool', pkgVersion, msg: toolEvent })
        segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
      }
    }
  })
}

/**
 * Wraps the _call method on a Tool instance.
 * This has to be done on the instance because it's an abstract method that only
 * gets defined at construction. This function will only get called if `_call` isn't
 * wrapped.
 *
 * @param {object} shim langchain shim instance
 * @param {Function} orig the original _call function
 * @returns {Function} wrapped _call function
 */
function wrapUnderCall(shim, orig) {
  return function wrappedCall() {
    const callArgs = shim.argsToArray.apply(shim, arguments)
    const segment = shim.getActiveSegment()
    if (segment) {
      segment[langchainRunId] = callArgs?.[1]?.runId
    }
    return orig.apply(this, arguments)
  }
}
