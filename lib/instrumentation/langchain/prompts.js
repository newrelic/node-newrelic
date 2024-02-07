/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { DESTINATIONS } = require('../../config/attribute-filter')
const { LangChainCompletionMesssage } = require('../../llm-events/langchain/')

function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`Llm/agent/Langchain/invoke/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  shim.record(
    langchain.BasePromptTemplate.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      const wrappedInvoke = shim.isWrapped(this, 'invoke')

      return {
        name: `Llm/agent/Langchain/${invoke}`,
        promise: true,
        after(_shim, _fn, _name, output, segment) {
          const messageEvent = new LangChainCompletionMesssage({ agent, output, segment })

          recordEvent({ agent, type: 'LlmChatCompletionMessage', pkgVersion, msg: messageEvent })
        }
      }
    }
  )
}
