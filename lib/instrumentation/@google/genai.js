/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { googleGenAiHeaders } = require('../../../lib/symbols')
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
 * @param {GenerateContentResponse} params.response chat completion response
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

  response.headers = segment[googleGenAiHeaders]
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

  delete response.headers
}

function instrumentStream ({ agent, shim, request, response, segment, transaction }) {
  if (!agent.config.ai_monitoring.streaming.enabled) {
    shim.logger.warn(
      '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
    )
    agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
  }

  let err
  shim.wrap(response, 'next', function wrapNext(shim, originalNext) {
    return async function wrappedNext(...nextArgs) {
      const result = await originalNext.apply(response, nextArgs)
      if (result) {
        segment.touch()
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

  /**
   * Instrumentation is only done to get the response headers and attach
   * to the active segment as @google/genai hides the headers from the functions
   * we are trying to instrument.
   * see: https://github.com/googleapis/js-genai/blob/cd0454862b4a0251d2606eeca8500b3b76004944/src/models.ts#L200
   */
  const httpResponse = googleGenAi.HttpResponse
  shim.wrap(httpResponse.prototype, 'json', function wrapJson(shim, func) {
    return async function wrappedJson() {
      const response = await func.apply(this, arguments)
      if (response) {
        // TODO: this does get some headers but not 'x-goog*'
        const headers = this.headers
        if (headers) {
          // decorate the segment with the headers
          const segment = shim.getActiveSegment()

          if (segment) {
            segment[googleGenAiHeaders] = headers
          }
        }
      }
      return response
    }
  })

  const models = googleGenAi.Models

  /**
   * Instruments chat completion creation
   * and creates the LLM events
   */
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

  /**
   * Instruments chat completion streaming
   * and creates the LLM events
   */
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

  /**
   * Instruments embedding creation
   * and creates LlmEmbedding event
   */
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

          // explicitly end segment to get consistent duration
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

          // cleanup keys on response before returning to user code
          delete response.headers
        }
      })
    }
  )
}
