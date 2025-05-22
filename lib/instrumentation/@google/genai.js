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

  // response.headers = segment[]
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
  const messages = [request.contents, response?.candidates?.[0]?.content?.parts?.[0]]
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

module.exports = function initialize(agent, googleGenAi, moduleName, shim) {
  if (agent?.config?.ai_monitoring?.enabled !== true) {
    shim.logger.debug('config.ai_monitoring.enabled is set to false. Skipping instrumentation.')
    return
  }
  // Update the tracking metric name with the version of the library
  // being instrumented. We do not have access to the version when
  // initially declaring the variable.
  TRACKING_METRIC = `${TRACKING_METRIC}/${shim.pkgVersion}`

  const models = googleGenAi.Models
  // TODO: why is generateContentInternal and generateContentStreamInternal
  // exposed but not generateContent or generateContentStream?

  /**
   * Instrumentation is only done to get the response headers and attach
   * to the active segment as @google/genai hides the headers from the functions
   * we are trying to instrument.
   * see: https://github.com/googleapis/js-genai/blob/cd0454862b4a0251d2606eeca8500b3b76004944/src/models.ts#L200
   *
   * TODO: Do we even need the headers?
   */
  shim.wrap(models.prototype, 'processParamsForMcpUsage', function wrapProcessParamsForMcpUsage(shim, original) {
    return async function wrappedProcessParamsForMcpUsage(...args) {
      // Call the original function and capture the result
      const newParams = await original.apply(this, arguments)

      // Inspect the headers in newParams
      const headers = newParams?.config?.httpOptions?.headers
      shim.logger.debug('Headers in newParams:', headers)

      // Return the modified newParams
      return newParams
    }
  })

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

  /*
    * Chat completions create can return a stream once promise resolves
    * This wraps the iterator which is a generator function
    * We will call the original iterator, intercept chunks and yield
    * to the original. On complete we will construct the new message object
    * with what we have seen in the stream and create the chat completion
    * messages
    */

  // TODO: might need to instrument processAfcStream too
  // https://github.com/googleapis/js-genai/blob/cd0454862b4a0251d2606eeca8500b3b76004944/src/models.ts#L183
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
        after({ error: err, result: response, segment, transaction }) {
          // Symbol.asyncIterator
          // FIXME: it's causing recursion
          shim.wrap(response, Symbol.asyncIterator, function wrapIterator(shim, orig) {
            const originalAsyncIterator = orig
            return async function * wrappedIterator() {
              let content = ''
              let role = ''
              let chunk
              let err
              try {
                const iterator = originalAsyncIterator.apply(this, arguments)
                for await (chunk of iterator) {
                  if (chunk.choices?.[0]?.delta?.role) {
                    role = chunk.choices[0].delta.role
                  }

                  content += chunk.choices?.[0]?.delta?.content ?? ''
                  yield chunk
                }
              } catch (streamErr) {
                err = streamErr
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

                addLlmMeta({ agent, transaction })
              }
            }
          })
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
          // delete response.headers
        }
      })
    }
  )
}
