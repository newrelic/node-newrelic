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
const LlmErrorMessage = require('../../llm-events/error-message')
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
        after(_shim, _fn, _name, err, output, segment) {
          segment.end()
          const completionSummary = new LangChainCompletionSummary({
            agent,
            messages: [{ output }],
            metadata,
            tags,
            segment,
            error: err != null,
            runId: segment[langchainRunId]
          })

          common.recordEvent({
            agent,
            type: 'LlmChatCompletionSummary',
            pkgVersion,
            msg: completionSummary
          })

          // output can be BaseMessage with a content property https://js.langchain.com/docs/modules/model_io/concepts#messages
          // or an output parser https://js.langchain.com/docs/modules/model_io/concepts#output-parsers
          recordCompletions({
            events: [request, output],
            completionSummary,
            agent,
            segment,
            shim
          })

          if (err) {
            agent.errors.add(
              segment.transaction,
              err,
              new LlmErrorMessage({
                response: {},
                cause: err,
                summary: completionSummary
              })
            )
          }

          segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
        }
      })
    }
  )
}

function recordCompletions({ events, completionSummary, agent, segment, shim }) {
  for (let i = 0; i < events.length; i += 1) {
    let msg = events[i]
    if (msg?.content) {
      msg = msg.content
    }

    let msgString
    try {
      msgString = typeof msg === 'string' ? msg : JSON.stringify(msg)
    } catch (error) {
      shim.logger.error(error, 'Failed to stringify message')
      msgString = ''
    }

    const completionMsg = new LangChainCompletionMessage({
      sequence: i,
      agent,
      content: msgString,
      completionId: completionSummary.id,
      segment,
      runId: segment[langchainRunId],
      // We call the final output in a LangChain "chain" the "response":
      isResponse: i === events.length - 1
    })

    common.recordEvent({
      agent,
      type: 'LlmChatCompletionMessage',
      pkgVersion: shim.pkgVersion,
      msg: completionMsg
    })
  }
}
