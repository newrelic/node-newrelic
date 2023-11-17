/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { openAiHeaders, openAiApiKey } = require('../../lib/symbols')
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding
} = require('../../lib/llm-events/openai')
const LlmTrackedIds = require('../../lib/llm-events/tracked-ids')
const OpenAiLlmError = require('../llm-events/openai/llm-error')

const MIN_VERSION = '4.0.0'
const { AI } = require('../../lib/metrics/names')
const semver = require('semver')

/**
 * Checks if we should skip instrumentation.
 * Currently it checks if `ai_monitoring.enabled` is true
 * and the package version >= 4.0.0
 *
 * @param {object} config agent config
 * @param {Shim} shim instance of shim
 * @returns {boolean} flag if instrumentation should be skipped
 */
function shouldSkipInstrumentation(config, shim) {
  if (config?.ai_monitoring?.enabled !== true) {
    shim.logger.debug('config.ai_monitoring.enabled is set to false.')
    return true
  }

  const { version: pkgVersion } = shim.require('./package.json')
  return semver.lt(pkgVersion, MIN_VERSION)
}

// eslint-disable-next-line sonarjs/cognitive-complexity
module.exports = function initialize(agent, openai, moduleName, shim) {
  if (shouldSkipInstrumentation(agent.config, shim)) {
    shim.logger.debug(
      `${moduleName} instrumentation support is for versions >=${MIN_VERSION}. Skipping instrumentation.`
    )
    return
  }

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

      // If the result is an error, which is an OpenAI client error, then
      // the headers are provided via a proxy attached to `result.headers`.
      // Otherwise, result is a typical response-like object.
      const headers = result?.response?.headers
        ? Object.fromEntries(result.response.headers)
        : { ...result?.headers }
      segment[openAiHeaders] = headers
    }
  }

  /**
   * Enqueues a LLM event to the custom event aggregator
   *
   * @param {string} type of LLM event
   * @param {object} msg LLM event
   */
  function recordEvent(type, msg) {
    msg = agent?.llm?.metadata ? { ...agent.llm.metadata, ...msg } : msg
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
   * Assigns requestId, conversationId and messageIds for a given
   * chat completion response on the active transaction.
   * This is used for generating LlmFeedbackEvent via `api.recordLlmFeedbackEvent`
   *
   * @param {object} params input params
   * @param {Transaction} params.tx active transaction
   * @param {LlmChatCompletionMessage} params.completionMsg chat completion message
   * @param {string} params.responseId id of response
   */
  function assignIdsToTx({ tx, completionMsg, responseId }) {
    const tracker = tx.llm.responses
    const trackedIds =
      tracker.get(responseId) ??
      new LlmTrackedIds({
        requestId: completionMsg.request_id,
        conversationId: completionMsg.conversation_id
      })
    trackedIds.message_ids.push(completionMsg.id)
    tracker.set(responseId, trackedIds)
  }

  /**
   * Generates LlmChatCompletionSummary for a chat completion creation.
   * Also iterates over both input messages and the first response message
   * and creates LlmChatCompletionMessage.
   *
   * Also assigns relevant ids by response id for LlmFeedbackEvent creation
   *
   * @param {object} params input params
   * @param {TraceSegment} params.segment active segment from chat completion
   * @param {object} params.request chat completion params
   * @param {object} params.response chat completion response
   * @returns {LlmChatCompletionSummary} A summary object.
   */
  function recordChatCompletionMessages({ segment, request, response }) {
    const tx = segment.transaction
    const completionSummary = new LlmChatCompletionSummary({
      agent,
      segment,
      request,
      response
    })

    // Only take the first response message and append to input messages
    const messages = [...request.messages, response?.choices?.[0]?.message]
    messages.forEach((message, index) => {
      const completionMsg = new LlmChatCompletionMessage({
        agent,
        segment,
        request,
        response,
        index,
        completionId: completionSummary.id,
        message
      })

      assignIdsToTx({ tx, completionMsg, responseId: response.id })
      recordEvent('LlmChatCompletionMessage', completionMsg)
    })

    recordEvent('LlmChatCompletionSummary', completionSummary)

    return completionSummary
  }

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
        name: `${AI.OPEN_AI}/Chat/Completions/Create`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, response, segment) {
          if (!response) {
            // If we get an error, it is possible that `response = null`.
            // In that case, we define it to be an empty object.
            response = {}
          }
          response.headers = segment[openAiHeaders]
          response.api_key = segment[openAiApiKey]

          const summary = recordChatCompletionMessages({
            segment,
            request,
            response
          })

          if (err) {
            const llmError = new OpenAiLlmError({ cause: err, summary, response })
            shim.agent.errors.add(segment.transaction, llmError)
          }

          // cleanup keys on response before returning to user code
          delete response.api_key
          delete response.headers
        }
      }
    }
  )

  /**
   * Instruments embedding creation
   * and creates LlmEmbedding event
   */
  shim.record(
    openai.Embeddings.prototype,
    'create',
    function wrapEmbeddingCreate(shim, embeddingCreate, name, args) {
      const [request] = args
      return {
        name: `${AI.OPEN_AI}/Embeddings/Create`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, response, segment) {
          if (!response) {
            // If we get an error, it is possible that `response = null`.
            // In that case, we define it to be an empty object.
            response = {}
          }
          response.headers = segment[openAiHeaders]
          response.api_key = segment[openAiApiKey]
          const embedding = new LlmEmbedding({
            agent,
            segment,
            request,
            response
          })

          recordEvent('LlmEmbedding', embedding)

          if (err) {
            const llmError = new OpenAiLlmError({ cause: err, embedding, response })
            shim.agent.errors.add(segment.transaction, llmError)
          }

          // cleanup keys on response before returning to user code
          delete response.api_key
          delete response.headers
        }
      }
    }
  )
}
