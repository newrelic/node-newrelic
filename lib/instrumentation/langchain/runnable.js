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
  debugger

  shim.record(
    langchain.RunnableSequence.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      debugger
      const [request, params] = args

      return {
        name: `Llm/agent/Langchain/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          [request, output].forEach((msg, sequence) => {
            const completionMsg = new LangChainCompletionMessage({
              sequence,
              agent,
              content: JSON.stringify(msg), 
              segment
            })

          recordEvent({ agent, type: 'LlmChatCompletionMessage', pkgVersion, msg: completionMsg })
         })

         // TODO: create chat completion summary
      }
    }
  })
}
