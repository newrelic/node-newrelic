/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { DESTINATIONS } = require('../../config/attribute-filter')
const { LangChainCompletionMessage } = require('../../llm-events/langchain/')

function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`Nodejs/ML/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  shim.record(
    langchain.BaseChatModel.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      const [request, params] = args

      return {
        name: `Llm/agent/Langchain/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          request.messages.forEach((message) => {
            const completionMsg = new LangChainCompletionMessage({
              agent,
              content: message.content,
              segment
            })

            recordEvent({ agent, type: 'LlmChatCompletionMessage', pkgVersion, msg: completionMsg })
          })

          // doesn't have output messages like prompts?
          const completionMsg = new LangChainCompletionMessage({
            agent,
            content: output.content,
            segment
          })

          recordEvent({
            agent,
            type: 'LlmChatCompletionMessage',
            pkgVersion,
            msg: completionMsg
          })
        }
      }
    }
  )
}
