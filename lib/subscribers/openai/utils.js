/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmErrorMessage
} = require('../../llm-events/openai')
const { extractLlmContext } = require('../../util/llm-utils')

const { AI } = require('../../metrics/names')
const { OPENAI } = AI
const { DESTINATIONS } = require('../../config/attribute-filter')
let TRACKING_METRIC = OPENAI.TRACKING_PREFIX

/**
 * Parses the response from OpenAI and extracts the message content and role.
 *
 * @param {object} response The OpenAI SDK response object
 * @returns {object[]} an array with the message object with fields `content`
 * and `role` or [] if response invalid
 */
function getMessageFromResponse(response) {
  let content
  let role
  if (response?.object === 'response') {
    content = response?.output?.[0]?.content?.[0]?.text
    role = response?.output?.[0]?.role
  } else {
    const choice = response?.choices?.[0]
    if (choice?.finish_reason === 'tool_calls') {
      // A false response. Don't create a LlmChatCompletionMessage
      // for this -- the full conversation isn't done yet.
      return []
    }
    content = choice?.message?.content
    role = choice?.message?.role
  }

  return [{ content, role }]
}

/**
 * Parses all messages from the OpenAI request object.
 *
 * @param {object} request The OpenAI SDK request object
 * @param {Logger} logger instance
 * @returns {Array<object>} an array of message objects with fields `content` and `role`
 */
function getMessagesFromRequest(request, logger) {
  // There are a few different ways to pass messages to OpenAI SDK.
  //
  // For langchain and `chat.completions.create`, messages are passed
  // as an array of objects with `content` and `role` properties
  // to the `messages` field of the request.
  //
  // For `responses.create`, messages are passed as an array of objects
  // with `content` and `role` properties OR as a single string (implied
  // to be a user message) to the `input` field of the request.
  let messages = []

  if (Array.isArray(request?.input)) {
    // Handle array of input messages
    messages = request.input.filter((msg) => msg?.content && msg?.role)
  } else if (typeof request?.input === 'string') {
    // Handle single string input as a user message
    messages = [{ content: request.input, role: 'user' }]
  } else if (Array.isArray(request?.messages)) {
    // Handle array of messages
    messages = request.messages.filter((msg) => msg?.content && msg?.role)
  } else {
    logger.warn('No valid messages found in OpenAI request object.')
  }

  return messages
}

/**
 * Enqueues a LLM event to the custom event aggregator.
 *
 * Will use `msg.timestamp` instead of the current time
 * for `timestamp` if present.
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {string} params.type LLM event type
 * @param {object} params.msg LLM event
 */
function recordEvent({ agent, type, msg }) {
  const llmContext = extractLlmContext(agent)
  // Spec 771: The `timestamp` attribute MUST be used to override
  // the timestamp value attached to the intrinsics of the custom
  // LlmChatCompletionMessage event before it is recorded using
  // record_custom_event().
  agent.customEventAggregator.add([
    { type, timestamp: msg?.timestamp ?? Date.now() },
    Object.assign({}, msg, llmContext)
  ])
}

/**
 * Increments the tracking metric and sets the llm attribute on transactions
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {Transaction} params.transaction active transaction
 * @param {string} params.version package version
 */
function addLlmMeta({ agent, transaction, version }) {
  TRACKING_METRIC = `${TRACKING_METRIC}/${version}`
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
 * @param {object} params.headers request headers
 * @param {Logger} params.logger logger instance
 * @param {TraceSegment} params.segment active segment from chat completion
 * @param {object} params.request chat completion params
 * @param {object} params.response chat completion response
 * @param {boolean} [params.err] err if it exists
 * @param {Transaction} params.transaction active transaction
 */
function recordChatCompletionMessages({
  agent,
  headers,
  logger,
  segment,
  request,
  response,
  err,
  transaction
}) {
  if (shouldSkipInstrumentation(agent.config, logger) === true) {
    logger.debug('skipping sending of ai data')
    return
  }

  if (!response) {
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    response = {}
  }

  response.headers = headers
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

  // Note: langchain still expects a message event even
  // when the response is empty, so we will not filter
  // the response message.
  const messages = [
    ...getMessagesFromRequest(request, logger),
    ...getMessageFromResponse(response)
  ]

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const completionMsg = new LlmChatCompletionMessage({
      agent,
      segment,
      transaction,
      request,
      response,
      index: i,
      completionId: completionSummary.id,
      message
    })

    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: completionMsg })
  }

  recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: completionSummary })

  if (err) {
    const llmError = new LlmErrorMessage({ cause: err, summary: completionSummary, response })
    agent.errors.add(transaction, err, llmError)
  }

  delete response.headers
}

/**
 * Checks if we should skip instrumentation.
 * Currently, just checks if `ai_monitoring.enabled` is true.
 *
 * @param {object} config agent config
 * @param {Logger} logger instance
 * @returns {boolean} flag if instrumentation should be skipped
 */
function shouldSkipInstrumentation(config, logger) {
  if (config?.ai_monitoring?.enabled !== true) {
    logger.debug('config.ai_monitoring.enabled is set to false.')
    return true
  }
  return false
}

/**
 * `chat.completions.create` can return a stream once promise resolves.
 * This wraps the iterator which is a generator function.
 * We will call the original iterator, intercept chunks and yield
 * to the original. On complete, we will construct the new message object
 * with what we have seen in the stream and create the chat completion
 * messages.
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {object} params.headers request headers
 * @param {object} params.logger logger instance
 * @param {object} params.request chat completion params
 * @param {object} params.response chat completion response
 * @param {TraceSegment} params.segment active segment from chat completion
 * @param {Transaction} params.transaction active transaction
 * @param {Error} [params.err] error if it exists
 */
function instrumentStream({ agent, headers, logger, request, response, segment, transaction, err = null }) {
  if (!agent.config.ai_monitoring.streaming.enabled) {
    logger.warn(
      '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
    )
    agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
    return
  }

  if (err) {
    // If there is an error already e.g. APIConnectionError,
    // the iterator will not be called, so we have to
    // record the chat completion messages with the error now.
    segment.touch()
    recordChatCompletionMessages({
      agent,
      headers,
      logger,
      segment,
      transaction,
      request,
      response,
      err
    })
    return
  }

  const orig = response.iterator
  response.iterator = async function * wrappedIterator() {
    let content = ''
    let role = ''
    let finishReason = ''
    let chunk
    try {
      const iterator = orig.apply(this, arguments)

      for await (chunk of iterator) {
        if (chunk.choices?.[0]?.delta?.role) {
          role = chunk.choices[0].delta.role
        }

        if (chunk.choices?.[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason
        }

        content += chunk.choices?.[0]?.delta?.content ?? ''
        yield chunk
      }
    } catch (streamErr) {
      err = streamErr
      throw err
    } finally {
      // when `chunk.choices` is an array that means the completions API is being used
      // we must re-assign the finish reason, and construct a message object with role and content
      // This is because if `include_usage` is enabled, the last chunk only contains usage info and no message deltas
      if (Array.isArray(chunk?.choices)) {
        chunk.choices = [{ finish_reason: finishReason, message: { role, content } }]
      // This means it is the responses API and the entire message is in the response object
      } else if (chunk?.response) {
        chunk = chunk.response
      }

      // update segment duration since we want to extend the time it took to
      // handle the stream
      segment.touch()

      recordChatCompletionMessages({
        agent,
        headers,
        logger,
        segment,
        transaction,
        request,
        response: chunk,
        err
      })
    }
  }
}

function recordEmbeddingMessage({
  agent,
  logger,
  request,
  headers,
  response,
  segment,
  transaction,
  err
}) {
  if (!response) {
    // If we get an error, it is possible that `response = null`.
    // In that case, we define it to be an empty object.
    response = {}
  }

  segment.end()
  if (shouldSkipInstrumentation(agent.config, logger) === true) {
    // We need this check inside the wrapper because it is possible for monitoring
    // to be disabled at the account level. In such a case, the value is set
    // after the instrumentation has been initialized.
    logger.debug('skipping sending of ai data')
    return
  }

  response.headers = headers
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
    agent.errors.add(transaction, err, llmError)
  }

  // cleanup keys on response before returning to user code
  delete response.headers
}

module.exports = {
  addLlmMeta,
  instrumentStream,
  recordChatCompletionMessages,
  recordEmbeddingMessage
}
