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
const { DESTINATIONS } = require('../../config/attribute-filter')
const { langchainRunId } = require('../../symbols')
const { RecorderSpec } = require('../../shim/specs')

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  if (common.shouldSkipInstrumentation(agent.config)) {
    shim.logger.debug(
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    return
  }

  shim.record(
    langchain.RunnableSequence.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      const [request, params] = args
      const metadata = params?.metadata ?? {}
      const tags = params?.tags ?? []

      return new RecorderSpec({
        name: `${LANGCHAIN.CHAIN}/${fnName}`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, _err, output, segment) {
          segment.end()
          const completionSummary = new LangChainCompletionSummary({
            agent,
            messages: [{ output }],
            metadata,
            tags,
            segment,
            runId: segment[langchainRunId]
          })

          common.recordEvent({
            agent,
            type: 'LlmChatCompletionSummary',
            pkgVersion,
            msg: completionSummary
          })

          const data = [request, output]

          // output can be BaseMessage with a content property https://js.langchain.com/docs/modules/model_io/concepts#messages
          // or an output parser https://js.langchain.com/docs/modules/model_io/concepts#output-parsers
          data.forEach((msg, sequence) => {
            if (msg?.content) {
              msg = msg.content
            }

            let msgString
            try {
              msgString = typeof msg === 'string' ? msg : JSON.stringify(msg)
            } catch (err) {
              shim.logger.error(err, 'Failed to stringify message')
              msgString = ''
            }

            const completionMsg = new LangChainCompletionMessage({
              sequence,
              agent,
              content: msgString,
              completionId: completionSummary.id,
              segment,
              runId: segment[langchainRunId]
            })

            common.recordEvent({
              agent,
              type: 'LlmChatCompletionMessage',
              pkgVersion,
              msg: completionMsg
            })
          })
          segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
        }
      })
    }
  )
}
