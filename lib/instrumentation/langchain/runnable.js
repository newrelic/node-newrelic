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
  debugger

  shim.record(
    langchain.RunnableSequence.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      debugger
      // if (!shim.isWrapped(this, '_invoke')) {
      //   shim.wrap(this, '_invoke', function wrapUnderInvoke(shim, orig) {
      //     debugger
      //     return function wrappedUnderInvoke() {
      //       const args = shim.argsToArray.apply(shim, arguments)
      //       const segment = shim.getActiveSegment()
      //       segment[runId] = args?.[1]?.runId
      //       return orig.apply(this, arguments)
      //     }
      //   })
      // }
      const [request, params] = args
      const { metadata, tags, callbacks } = params

      return {
        name: `${LANGCHAIN.AGENT}/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          // const metadata = common.getMetadata(segment[metadata])
          // const tags = common.getTags(segment[tags])
          // segment.end()

          const completionSummary = new LangChainCompletionSummary({
            agent,
            messages: [{ output }],
            // metadata,
            // tags,
            segment
          })

          common
            .recordEvent({
              agent,
              type: 'LlmChatCompletionSummary',
              pkgVersion,
              msg: completionSummary
            })

            [(request, output)].forEach((msg, sequence) => {
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
                type: 'LlmChatCompletionMessage',
                pkgVersion,
                msg: completionMsg
              })
            })
        }
      }
    }
  )
}
