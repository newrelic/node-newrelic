/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { DESTINATIONS } = require('../../config/attribute-filter')

// eslint-disable-next-line node/no-missing-require
const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')

function recordEvent({ agent, type, msg }) {
  agent.metrics.getOrCreateMetric('Llm/agent/Langchain/invoke').incrementCallCount()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

module.exports = function initialize(shim, langchain) {
  shim.record(
    langchain.BasePromptTemplate.prototype,
    'invoke',
    function wrapCall(shim, invoke, fnName, args) {
      const cbHandler = BaseCallbackHandler.fromMethods({
        handleLLMStart() {},
        handleChainStart() {},
        handleChainEnd() {},
        handleLLMEnd() {},
        handleLLMError() {}
      })

      if (args[1].callbacks === undefined) {
        args[1].callbacks = []
      }

      args[1].callbacks = [cbHandler, ...args[1].callbacks]

      invoke.call(this, fnName, args)

      return {
        name: `Llm/agent/Langchain/${invoke}`,
        promise: true,
        after(_shim, fn, _name, response, segment) {
          segment.transaction.trace.attributes.addAttribute(
            DESTINATIONS.TRANS_EVENT,
            'virtual_llm',
            true
          )

          recordEvent()
        }
      }
    }
  )
}
