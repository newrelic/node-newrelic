/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// https://js.langchain.com/docs/expression_language/get_started#basic-example-prompt--model--output-parser

// const { BaseCallbackHandler } = require('@langchain/core/callbacks/base')
// const { BaseChatModel } = require('@langchain/core/language_models/chat_models')
// const { BasePromptTemplate } = require('@langchain/core/prompts')

module.exports = function initialize(agent, langchain, moduleName, shim) {
  shim.record(
    langchain.BasePromptTemplate.prototype,
    'invoke',
    function wrapInvokePromptTemplate(shim, orig, input, options) {
      const cbHandler = langchain.BaseCallbackHandler.fromMethods({
        handleLLMStart() {},
        handleChainStart() {},
        handleChainEnd() {},
        handleLLMEnd() {},
        handleLLMError() {}
      })

      if (options.callbacks === undefined) {
        options.callbacks = []
      }
      options.callbacks = [cbHandler, ...options.callbacks]
      return orig.call(this, input, options)
    }
  )

  shim.record(langchain.BaseChatModel.prototype, 'invoke', function wrapInvokeChatModel() {
    // create instance of handler
    // add callback to options
  })
}
