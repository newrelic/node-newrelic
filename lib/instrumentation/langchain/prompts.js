/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { DESTINATIONS } = require('../../config/attribute-filter')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('../../llm-events/langchain/')

function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`Nodejs/ML/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  shim.record(
    langchain.BasePromptTemplate.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      const { inputVariables } = this
      const [request, params] = args

      return {
        name: `Llm/agent/Langchain/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          const inputs = inputVariables.map((name) => request[name])

          inputs.forEach((input) => {
            const completionMsg = new LangChainCompletionMessage({ agent, content: input, segment })

            recordEvent({ agent, type: 'LlmChatCompletionMessage', pkgVersion, msg: completionMsg })
          })

          // are there n outputs?
          const completionSummary = new LangChainCompletionSummary({
            agent,
            messages: output.messages,
            segment
          })

          recordEvent({
            agent,
            type: 'LlmChatCompletionSummary',
            pkgVersion,
            msg: completionSummary
          })
        }
      }
    }
  )
}
