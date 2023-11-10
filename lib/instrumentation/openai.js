/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { openAiHeaders, openAiApiKey } = require('../../lib/symbols')
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary
} = require('../../lib/llm-events/openai')

module.exports = function initialize(agent, openai, moduleName, shim) {
  /**
   * Adds apiKey and response headers to the active segment
   * on symbols
   *
   * @param {object} result from openai request
   * @param {string} apiKey api key from openai client
   */
  function decorateSegment(result, apiKey) {
    const segment = shim.getActiveSegment()

    if (segment) {
      segment[openAiApiKey] = apiKey
      segment[openAiHeaders] =
        result?.response?.headers && Object.fromEntries(result.response.headers)
    }
  }

  /**
   * Enqueues a LLM event to the custom event aggregator
   *
   * @param {string} type of LLM event
   * @param {object} msg LLM event
   */
  function recordEvent(type, msg) {
    agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
  }

  /**
   * Instrumentation is only done to get the response headers and attach
   * to the active segment as openai hides the headers from the functions we are
   * trying to instrument
   */
  shim.wrap(openai.prototype, 'makeRequest', function wrapRequest(shim, makeRequest) {
    return function wrappedRequest() {
      const apiKey = this.apiKey
      const result = makeRequest.apply(this, arguments)
      result.then(
        (data) => {
          // add headers on resolve
          decorateSegment(data, apiKey)
        },
        (data) => {
          // add headers on reject
          decorateSegment(data, apiKey)
        }
      )
      return result
    }
  })

  /**
   * Instruments chat completion creation
   * and creates the LLM events
   *
   * **Note**: Currently only for promises. streams will come later
   */
  shim.record(
    openai.Chat.Completions.prototype,
    'create',
    function wrapCreate(shim, create, name, args) {
      const [request] = args
      return {
        name: 'AI/OpenAI/Chat/Completions/Create',
        promise: true,
        opaque: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, response, segment) {
          response.headers = segment[openAiHeaders]
          response.api_key = segment[openAiApiKey]

          // TODO: add LlmErrorMessage on failure
          // and exit
          // See: https://github.com/newrelic/node-newrelic/issues/1845
          // if (err) {}

          const completionSummary = new LlmChatCompletionSummary({
            agent,
            segment,
            request,
            response
          }).serialize()

          recordEvent('LlmChatCompletionSummary', completionSummary)

          request.messages.forEach((_msg, index) => {
            const completionMsg = new LlmChatCompletionMessage({
              agent,
              segment,
              request,
              response,
              index
            }).serialize()

            recordEvent('LlmChatCompletionMessage', completionMsg)
          })

          // cleanup keys on response before returning to user code
          delete response.api_key
          delete response.headers
        }
      }
    }
  )
}
