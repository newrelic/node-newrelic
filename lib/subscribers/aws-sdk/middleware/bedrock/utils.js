/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmErrorMessage,
  BedrockResponse
} = require('#agentlib/llm-events/aws-bedrock/index.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const StreamHandler = require('./stream-handler.js')
const ConverseStreamHandler = require('./converse-stream-handler.js')
const { extractLlmContext } = require('#agentlib/util/llm-utils.js')
const { STREAMING_COMMANDS } = require('./constants')

let TRACKING_METRIC

/**
 * Defers the creation of the `TRACKING_METRIC` constant
 *
 * @param {string} metric name of metric
 */
function setTrackingMetric(metric) {
  TRACKING_METRIC = metric
}

/**
 * Checks if ai_monitoring is enabled
 * @param {object} config agent config
 * @returns {boolean} if ai monitoring is enabled
 */
function shouldSkipInstrumentation(config) {
  return config.ai_monitoring.enabled === false
}

/**
 * Checks if streaming is enabled
 * @param {object} params to fn
 * @param {string} params.commandName name of command
 * @param {object} params.config agent config
 * @returns {boolean} if streaming is enabled
 */
function isStreamingEnabled({ commandName, config }) {
  return (
    STREAMING_COMMANDS.has(commandName) &&
    config.ai_monitoring?.streaming?.enabled
  )
}

/**
 * Records a custom event with LLM context
 * @param {object} params Parameters to function
 * @param {Agent} params.agent New Relic agent instance
 * @param {string} params.type Event type
 * @param {object} params.msg Message object to record
 */
function recordEvent({ agent, type, msg }) {
  const llmContext = extractLlmContext(agent)
  const timestamp = msg?.timestamp ?? Date.now()
  agent.customEventAggregator.add([
    { type, timestamp },
    Object.assign({}, msg, llmContext)
  ])
}

/**
 * Adds LLM metadata to metrics, transaction attributes, and ends the segment
 * @param {object} params Parameters to function
 * @param {Agent} params.agent New Relic agent instance
 * @param {TraceSegment} params.segment Current segment
 * @param {Transaction} params.transaction Current transaction
 */
function addLlmMeta({ agent, segment, transaction }) {
  agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  segment.end()
}

/**
 * Records chat completion messages and summary for LLM monitoring.
 * Creates message events for both prompts and completions, and records errors if present.
 * @param {object} params Parameters to function
 * @param {Agent} params.agent New Relic agent instance
 * @param {Logger} params.logger Logger instance
 * @param {TraceSegment} params.segment Current segment
 * @param {Transaction} params.transaction Current transaction
 * @param {BedrockCommand} params.bedrockCommand BedrockCommand object
 * @param {BedrockResponse} params.bedrockResponse BedrockResponse object
 * @param {Error} [params.err] Error object if it exists
 * @param {number} [params.timeOfFirstToken] Timestamp of first token for streaming responses
 */
function recordChatCompletionMessages({
  agent,
  logger,
  segment,
  transaction,
  bedrockCommand,
  bedrockResponse,
  err,
  timeOfFirstToken
}) {
  if (shouldSkipInstrumentation(agent.config) === true) {
    logger.debug('skipping sending of ai data')
    return
  }

  const summary = new LlmChatCompletionSummary({
    agent,
    bedrockResponse,
    bedrockCommand,
    transaction,
    segment,
    timeOfFirstToken,
    error: err !== null
  })

  const promptContextMessages = bedrockCommand.prompt
  for (let i = 0; i < promptContextMessages.length; i++) {
    const contextMessage = promptContextMessages[i]
    const msg = new LlmChatCompletionMessage({
      agent,
      segment,
      transaction,
      bedrockCommand,
      content: contextMessage.content,
      role: contextMessage.role,
      bedrockResponse,
      sequence: i,
      completionId: summary.id
    })
    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg })
  }

  for (let i = 0; i < bedrockResponse.completions.length; i++) {
    const content = bedrockResponse.completions[i]
    const chatCompletionMessage = new LlmChatCompletionMessage({
      agent,
      segment,
      transaction,
      bedrockCommand,
      bedrockResponse,
      isResponse: true,
      sequence: promptContextMessages.length + i,
      content,
      role: 'assistant',
      completionId: summary.id
    })
    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: chatCompletionMessage })
  }

  recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: summary })

  if (err) {
    const llmErrorMessage = new LlmErrorMessage({
      response: bedrockResponse,
      cause: err,
      summary
    })
    agent.errors.add(transaction, err, llmErrorMessage)
  }
}

/**
 * Records embedding messages for LLM monitoring.
 * Creates embedding events for each prompt and records errors if present.
 * @param {object} params Parameters to function
 * @param {Agent} params.agent New Relic agent instance
 * @param {Logger} params.logger Logger instance
 * @param {TraceSegment} params.segment Current segment
 * @param {Transaction} params.transaction Current transaction
 * @param {BedrockCommand} params.bedrockCommand BedrockCommand object
 * @param {BedrockResponse} params.bedrockResponse BedrockResponse object
 * @param {Error} [params.err] Error object if it exists
 */
function recordEmbeddingMessage({
  agent,
  logger,
  segment,
  transaction,
  bedrockCommand,
  bedrockResponse,
  err
}) {
  if (shouldSkipInstrumentation(agent.config) === true) {
    logger.debug('skipping sending of ai data')
    return
  }

  const embeddings = bedrockCommand.prompt.map((prompt) => new LlmEmbedding({
    agent,
    segment,
    transaction,
    bedrockCommand,
    requestInput: prompt.content,
    bedrockResponse,
    error: err !== null
  }))

  for (const embedding of embeddings) {
    recordEvent({ agent, type: 'LlmEmbedding', msg: embedding })
  }

  if (err) {
    const llmErrorMessage = new LlmErrorMessage({
      response: bedrockResponse,
      cause: err,
      embedding: embeddings.length === 1 ? embeddings[0] : undefined
    })
    agent.errors.add(transaction, err, llmErrorMessage)
  }
}

/**
 * Creates a BedrockResponse object from the command and response/error
 * @param {object} params Parameters to function
 * @param {BedrockCommand} params.bedrockCommand BedrockCommand object
 * @param {object} params.response AWS Bedrock response object
 * @param {Error} [params.err] Error object if it exists
 * @returns {BedrockResponse} BedrockResponse object
 */
function createBedrockResponse({ bedrockCommand, response, err }) {
  if (err) {
    return new BedrockResponse({ bedrockCommand, response: err, isError: err !== null })
  }
  return new BedrockResponse({ bedrockCommand, response })
}

/**
 * Handles the response (or error) from a bedrock call.
 * Called directly for non-streamed responses, or as onComplete
 * callback from StreamHandler/ConverseStreamHandler.
 *
 * Note: `this` is bound to the stream handler instance when called
 * as onComplete, providing `this.stopReason` and `this.timeOfFirstToken`.
 * @param {object} params Parameters to function
 * @param {Agent} params.agent New Relic agent instance
 * @param {Logger} params.logger Logger instance
 * @param {object} [params.err] Error object if it exists
 * @param {object} params.response AWS Bedrock reponse object
 * @param {TraceSegment} params.segment Current segment
 * @param {Transaction} params.transaction Current transaction
 * @param {BedrockCommand} params.bedrockCommand BedrockCommand object
 * @param {string} params.modelType AWS Bedrock model type
 */
function handleResponse({ agent, logger, err, response, segment, transaction, bedrockCommand, modelType }) {
  if (response?.output && this?.stopReason) {
    response.output.stopReason = this.stopReason
  }
  const bedrockResponse = createBedrockResponse({ bedrockCommand, response, err })

  addLlmMeta({ agent, segment, transaction })
  if (modelType === 'completion') {
    recordChatCompletionMessages({
      agent,
      logger,
      segment,
      transaction,
      bedrockCommand,
      bedrockResponse,
      timeOfFirstToken: this?.timeOfFirstToken,
      err
    })
  } else if (modelType === 'embedding') {
    recordEmbeddingMessage({
      agent,
      logger,
      segment,
      transaction,
      bedrockCommand,
      bedrockResponse,
      err
    })
  }
}

/**
 * Handles streaming responses by wrapping the stream with appropriate handler.
 * Uses ConverseStreamHandler for Converse API streams, otherwise uses StreamHandler.
 * @param {object} passThroughParams Parameters passed through to stream handlers
 * @param {BedrockCommand} passThroughParams.bedrockCommand BedrockCommand object
 * @param {object} passThroughParams.response AWS Bedrock response object
 * @param {Agent} passThroughParams.agent New Relic agent instance
 * @param {Logger} passThroughParams.logger Logger instance
 * @param {TraceSegment} passThroughParams.segment Current segment
 * @param {Transaction} passThroughParams.transaction Current transaction
 * @param {string} passThroughParams.modelType AWS Bedrock model type
 */
function handleStream(passThroughParams) {
  const { bedrockCommand, response } = passThroughParams
  if (bedrockCommand.isConverse) {
    const handler = new ConverseStreamHandler({
      stream: response.output.stream,
      onComplete: handleResponse,
      passThroughParams
    })
    response.output.stream = handler.generator(handleResponse)
  } else {
    const handler = new StreamHandler({
      stream: response.output.body,
      onComplete: handleResponse,
      passThroughParams
    })
    response.output.body = handler.generator(handleResponse)
  }
}

module.exports = {
  addLlmMeta,
  handleStream,
  handleResponse,
  isStreamingEnabled,
  setTrackingMetric,
  shouldSkipInstrumentation
}
