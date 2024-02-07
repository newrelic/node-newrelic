/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { DESTINATIONS } = require('../../config/attribute-filter')
const { LangChainCompletionMessage } = require('../../llm-events/langchain/')

function recordEvent({ agent, type, msg, pkgVersion }) {
  agent.metrics.getOrCreateMetric(`Llm/agent/Langchain/invoke/${pkgVersion}`).incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim
  debugger

  shim.record(
    langchain.BaseChatModel.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      debugger
      const [request, params] = args

      return {
        name: `Llm/agent/Langchain/${fnName}`,
        promise: true,
        after(_shim, _fn, _name, _err, output, segment) {
          debugger
          const r =  request 
          debugger
          const messageEvent = new LangChainCompletionMessage({ agent, output, segment })

          recordEvent({ agent, type: 'LlmChatCompletionMessage', pkgVersion, msg: messageEvent })
        }
      }
    }
  )
}
