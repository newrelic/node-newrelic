/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { openAiHeaders, openAiApiKey } = require('../../lib/symbols')
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmErrorMessage
} = require('../../lib/llm-events/openai')
const LlmTrackedIds = require('../../lib/llm-events/tracked-ids')

const MIN_VERSION = '4.0.0'
const MIN_STREAM_VERSION = '4.12.2'
const { AI } = require('../../lib/metrics/names')
const semver = require('semver')

let TRACKING_METRIC = AI.TRACKING_PREFIX

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

  const { pkgVersion } = shim
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

  // Update the tracking metric name with the version of the library
  // being instrumented. We do not have access to the version when
  // initially declaring the variable.
  TRACKING_METRIC = `${TRACKING_METRIC}OpenAI/${shim.pkgVersion}`

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
    agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
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
   * @param {boolean} [params.err] err if it exists
   */
  function recordChatCompletionMessages({ segment, request, response, err }) {
    if (!response) {
      // If we get an error, it is possible that `response = null`.
      // In that case, we define it to be an empty object.
      response = {}
    }

    response.headers = segment[openAiHeaders]
    response.api_key = segment[openAiApiKey]
    const tx = segment.transaction
    // explicitly end segment to consistent duration
    // for both LLM events and the segment
    segment.end()
    const completionSummary = new LlmChatCompletionSummary({
      agent,
      segment,
      request,
      response,
      withError: err != null
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

    if (err) {
      const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
      shim.agent.errors.add(segment.transaction, err, llmError)
    }

    delete response.headers
    delete response.api_key
  }

  /*
   * Chat completions create can return a stream once promise resolves
   * This wraps the iterator which is a generator function
   * We will call the original iterator, intercept chunks and yield
   * to the original. On complete we will construct the new message object
   * with what we have seen in the stream and create the chat completion
   * messages
   *
   */
  function instrumentStream({ request, response, segment }) {
    shim.wrap(response, 'iterator', function wrapIterator(shim, orig) {
      return async function* wrappedIterator() {
        let content = ''
        let role = ''
        let chunk
        let err
        try {
          const iterator = orig.apply(this, arguments)

          for await (chunk of iterator) {
            if (chunk.choices?.[0]?.delta?.role) {
              role = chunk.choices[0].delta.role
            }

            content += chunk.choices?.[0]?.delta?.content ?? ''
            yield chunk
          }
        } catch (streamErr) {
          err = streamErr
          throw err
        } finally {
          chunk.choices[0].message = { role, content }
          // update segment duration since we want to extend the time it took to
          // handle the stream
          segment.touch()

          recordChatCompletionMessages({
            segment,
            request,
            response: chunk,
            err
          })
        }
      }
    })
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
      if (request.stream && semver.lt(shim.pkgVersion, MIN_STREAM_VERSION)) {
        shim.logger.warn(
          `Instrumenting chat completion streams is only supported with openai version ${MIN_STREAM_VERSION}+.`
        )
        return
      }

      return {
        name: `${AI.OPEN_AI}/Chat/Completions/Create`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, response, segment) {
          if (request.stream) {
            instrumentStream({ request, response, segment })
          } else {
            recordChatCompletionMessages({
              segment,
              request,
              response,
              err
            })
          }
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
          // explicitly end segment to get consistent duration
          // for both LLM events and the segment
          segment.end()
          const embedding = new LlmEmbedding({
            agent,
            segment,
            request,
            response,
            withError: err != null
          })

          recordEvent('LlmEmbedding', embedding)

          if (err) {
            const llmError = new LlmErrorMessage({ cause: err, embedding, response })
            shim.agent.errors.add(segment.transaction, err, llmError)
          }

          // cleanup keys on response before returning to user code
          delete response.api_key
          delete response.headers
        }
      }
    }
  )
}
