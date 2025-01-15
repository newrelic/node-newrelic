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
const { RecorderSpec } = require('../../lib/shim/specs')
const { extractLlmContext } = require('../util/llm-utils')

const MIN_VERSION = '4.0.0'
const MIN_STREAM_VERSION = '4.12.2'
const { AI } = require('../../lib/metrics/names')
const { OPENAI } = AI
const semver = require('semver')
const { DESTINATIONS } = require('../config/attribute-filter')

let TRACKING_METRIC = OPENAI.TRACKING_PREFIX

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

/**
 * Adds apiKey and response headers to the active segment
 * on symbols
 *
 * @param {object} params input params
 * @param {Shim} params.shim instance of shim
 * @param {object} params.result from openai request
 * @param {string} params.apiKey api key from openai client
 */
function decorateSegment({ shim, result, apiKey }) {
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
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {string} params.type LLM event type
 * @param {object} params.msg LLM event
 */
function recordEvent({ agent, type, msg }) {
  const llmContext = extractLlmContext(agent)

  agent.customEventAggregator.add([
    { type, timestamp: Date.now() },
    Object.assign({}, msg, llmContext)
  ])
}

/**
 * Increments the tracking metric and sets the llm attribute on transactions
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {Transaction} params.transaction active transaction
 */
function addLlmMeta({ agent, transaction }) {
  agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
}

/**
 * Generates LlmChatCompletionSummary for a chat completion creation.
 * Also iterates over both input messages and the first response message
 * and creates LlmChatCompletionMessage.
 *
 * Also assigns relevant ids by response id for LlmFeedbackEvent creation
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {Shim} params.shim the current shim instance
 * @param {TraceSegment} params.segment active segment from chat completion
 * @param {object} params.request chat completion params
 * @param {object} params.response chat completion response
 * @param {boolean} [params.err] err if it exists
 * @param {Transaction} params.transaction active transaction
 */
function recordChatCompletionMessages({
  agent,
  shim,
  segment,
  request,
  response,
  err,
  transaction
}) {
  if (shouldSkipInstrumentation(agent.config, shim) === true) {
    shim.logger.debug('skipping sending of ai data')
    return
  }

  if (!response) {
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    response = {}
  }

  response.headers = segment[openAiHeaders]
  // explicitly end segment to consistent duration
  // for both LLM events and the segment
  segment.end()
  const completionSummary = new LlmChatCompletionSummary({
    agent,
    segment,
    transaction,
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
      transaction,
      request,
      response,
      index,
      completionId: completionSummary.id,
      message
    })

    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: completionMsg })
  })

  recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: completionSummary })

  if (err) {
    const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
    agent.errors.add(transaction, err, llmError)
  }

  delete response.headers
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
function instrumentStream({ agent, shim, request, response, segment, transaction }) {
  if (!agent.config.ai_monitoring.streaming.enabled) {
    shim.logger.warn(
      '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
    )
    agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
    return
  }

  shim.wrap(response, 'iterator', function wrapIterator(shim, orig) {
    return async function * wrappedIterator() {
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
          agent: shim.agent,
          shim,
          segment,
          transaction,
          request,
          response: chunk,
          err
        })
      }
    }
  })
}

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
  TRACKING_METRIC = `${TRACKING_METRIC}/${shim.pkgVersion}`

  /**
   * Instrumentation is only done to get the response headers and attach
   * to the active segment as openai hides the headers from the functions we are
   * trying to instrument
   */
  shim.wrap(openai.prototype, 'makeRequest', function wrapRequest(shim, makeRequest) {
    return function wrappedRequest() {
      const apiKey = this.apiKey
      const request = makeRequest.apply(this, arguments)
      request.then(
        (result) => {
          // add headers on resolve
          decorateSegment({ shim, result, apiKey })
        },
        (result) => {
          // add headers on reject
          decorateSegment({ shim, result, apiKey })
        }
      )
      return request
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
      if (request.stream && semver.lt(shim.pkgVersion, MIN_STREAM_VERSION)) {
        shim.logger.warn(
          `Instrumenting chat completion streams is only supported with openai version ${MIN_STREAM_VERSION}+.`
        )
        return
      }

      return new RecorderSpec({
        name: OPENAI.COMPLETION,
        promise: true,
        after({ error: err, result: response, segment, transaction }) {
          if (request.stream) {
            instrumentStream({ agent, shim, request, response, segment, transaction })
          } else {
            recordChatCompletionMessages({
              agent,
              shim,
              segment,
              transaction,
              request,
              response,
              err
            })
          }

          addLlmMeta({ agent, transaction })
        }
      })
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
      return new RecorderSpec({
        name: OPENAI.EMBEDDING,
        promise: true,
        after({ error: err, result: response, segment, transaction }) {
          addLlmMeta({ agent, transaction })

          if (!response) {
            // If we get an error, it is possible that `response = null`.
            // In that case, we define it to be an empty object.
            response = {}
          }

          segment.end()
          if (shouldSkipInstrumentation(shim.agent.config, shim) === true) {
            // We need this check inside the wrapper because it is possible for monitoring
            // to be disabled at the account level. In such a case, the value is set
            // after the instrumentation has been initialized.
            shim.logger.debug('skipping sending of ai data')
            return
          }

          response.headers = segment[openAiHeaders]
          // explicitly end segment to get consistent duration
          // for both LLM events and the segment

          const embedding = new LlmEmbedding({
            agent,
            segment,
            transaction,
            request,
            response,
            withError: err != null
          })

          recordEvent({ agent, type: 'LlmEmbedding', msg: embedding })

          if (err) {
            const llmError = new LlmErrorMessage({ cause: err, embedding, response })
            shim.agent.errors.add(transaction, err, llmError)
          }

          // cleanup keys on response before returning to user code
          delete response.headers
        }
      })
    }
  )
}
