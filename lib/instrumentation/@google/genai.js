/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmErrorMessage
} = require('../../../lib/llm-events/google-genai')
const { RecorderSpec } = require('../../../lib/shim/specs')
const { extractLlmContext } = require('../../util/llm-utils')

const { AI } = require('../../../lib/metrics/names')
const { GEMINI } = AI
const { DESTINATIONS } = require('../../config/attribute-filter')
let TRACKING_METRIC = GEMINI.TRACKING_PREFIX

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
  if (!response) {
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    response = {}
  }

  // Explicitly end segment to provide consistent duration
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
  // request.contents can be a string or an array of strings
  // response.candidates is an array of candidates (choices); we only take the first one
  const inputMessages = Array.isArray(request.contents) ? request.contents : [request.contents]
  const responseMessage = response?.candidates?.[0]?.content
  const messages = responseMessage !== undefined ? [...inputMessages, responseMessage] : inputMessages
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
}

function instrumentStream ({ agent, shim, request, response, segment, transaction }) {
  let err
  let content
  let modelVersion
  let finishReason
  let entireMessage = ''
  shim.wrap(response, 'next', function wrapNext(shim, originalNext) {
    return async function wrappedNext(...nextArgs) {
      let result = {}
      try {
        result = await originalNext.apply(response, nextArgs)
        if (result?.value?.text) {
          modelVersion = result.value.modelVersion
          content = result.value.candidates[0].content
          entireMessage += result.value.text // readonly variable that equates to result.value.candidates[0].content.parts[0].text
        }
        if (result?.value?.candidates?.[0]?.finishReason) {
          finishReason = result.value.candidates[0].finishReason
        }
      } catch (streamErr) {
        err = streamErr
        throw err
      } finally {
        // Update segment duration since we want to extend the
        // time it took to handle the stream
        segment.touch()

        // result will be {value: undefined, done: true}
        // when the stream is done, so we need to create
        // a mock GenerateContentResponse object with
        // the entire message
        //
        // also need to enter this block if there was an
        // error, so we can record it
        if (result?.done || err) {
          if (content) {
            content.parts[0].text = entireMessage
            result.value = {
              candidates: [
                { content, finishReason }
              ],
              modelVersion
            }
          }

          recordChatCompletionMessages({
            agent: shim.agent,
            shim,
            segment,
            transaction,
            request,
            response: result?.value,
            err
          })
        }
      }
      return result
    }
  })
}

module.exports = function initialize(agent, googleGenAi, moduleName, shim) {
  if (agent?.config?.ai_monitoring?.enabled !== true) {
    shim.logger.debug('config.ai_monitoring.enabled is set to false.')
    return
  }

  // Update the tracking metric name with the version of the library
  // being instrumented. We do not have access to the version when
  // initially declaring the variable.
  TRACKING_METRIC = `${TRACKING_METRIC}/${shim.pkgVersion}`

  const models = googleGenAi.Models

  // Instruments chat completion creation
  // and creates the LLM events
  shim.record(models.prototype, 'generateContentInternal',
    function wrapGenerateContent(shim, func, name, args) {
      const [request] = args

      return new RecorderSpec({
        name: GEMINI.COMPLETION,
        promise: true,
        after({ error: err, result: response, segment, transaction }) {
          recordChatCompletionMessages({
            agent,
            shim,
            segment,
            transaction,
            request,
            response,
            err
          })

          addLlmMeta({ agent, transaction })
        }
      })
    }
  )

  // Instruments chat completion streaming
  // and creates the LLM events
  shim.record(models.prototype, 'generateContentStreamInternal',
    function wrapGenerateContentStream(shim, func, name, args) {
      if (!agent.config.ai_monitoring.streaming.enabled) {
        shim.logger.warn(
          '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
        )
        agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
        return
      }
      const [request] = args

      return new RecorderSpec({
        name: GEMINI.COMPLETION,
        promise: true,
        after({ result: response, segment, transaction }) {
          instrumentStream({ agent, shim, request, response, segment, transaction })
          addLlmMeta({ agent, transaction })
        }
      })
    })

  // Instruments embedding creation
  // and creates LlmEmbedding event
  shim.record(
    models.prototype,
    'embedContent',
    function wrapEmbedContent(shim, func, name, args) {
      const [request] = args

      return new RecorderSpec({
        name: GEMINI.EMBEDDING,
        promise: true,
        after({ error: err, result: response, segment, transaction }) {
          addLlmMeta({ agent, transaction })

          if (!response) {
            // If we get an error, it is possible that `response = null`.
            // In that case, we define it to be an empty object.
            response = {}
          }

          // Explicitly end segment to get consistent duration
          // for both LLM events and the segment
          segment.end()

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
        }
      })
    }
  )
}
