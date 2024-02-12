/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./common')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('../../llm-events/langchain/')

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  if (common.shouldSkipInstrumentation(agent.config)) {
    shim.logger.debug(
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    return
  }
  debugger

  shim.record(
    langchain.RunnableSequence.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      debugger

      const [request, params] = args
      const { metadata, tags } = params

      return {
        name: `${LANGCHAIN.AGENT}/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          segment.end()
          const completionSummary = new LangChainCompletionSummary({
            agent,
            messages: [{ output }],
            metadata,
            tags,
            segment
          })

          common.recordEvent({
            agent,
            type: 'LlmChatCompletionSummary', // is this the right type?
            pkgVersion,
            msg: completionSummary
          })

          // this assumes that a basic example has: prompt + model + output parser
          const data = [request, output]
          data.forEach((msg, sequence) => {
            debugger
            const msgString = typeof msg === 'string' ? msg : JSON.stringify(msg)
            const completionMsg = new LangChainCompletionMessage({
              sequence,
              agent,
              content: msgString,
              completionId: completionSummary.id,
              segment
            })

            common.recordEvent({
              agent,
              type: 'LlmChatCompletionMessage', // is this the right type?
              pkgVersion,
              msg: completionMsg
            })
          })
        }
      }
    }
  )
}
