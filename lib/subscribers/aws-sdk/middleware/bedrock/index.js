/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const StreamHandler = require('./stream-handler.js')
const ConverseStreamHandler = require('./converse-stream-handler.js')
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  BedrockCommand,
  BedrockResponse
} = require('#agentlib/llm-events/aws-bedrock/index.js')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')
const { DESTINATIONS } = require('#agentlib/config/attribute-filter.js')
const { AI } = require('#agentlib/metrics/names.js')
const { extractLlmContext } = require('#agentlib/util/llm-utils.js')

let TRACKING_METRIC

const INSTRUMENTED_COMMANDS = new Set([
  'InvokeModelCommand',
  'InvokeModelWithResponseStreamCommand',
  'ConverseCommand',
  'ConverseStreamCommand'
])

const STREAMING_COMMANDS = new Set([
  'InvokeModelWithResponseStreamCommand',
  'ConverseStreamCommand'
])

const CONVERSE_COMMANDS = new Set([
  'ConverseCommand',
  'ConverseStreamCommand'
])

function shouldSkipInstrumentation(config) {
  return config.ai_monitoring.enabled === false
}

function isStreamingEnabled({ commandName, config }) {
  return (
    STREAMING_COMMANDS.has(commandName) &&
    config.ai_monitoring?.streaming?.enabled
  )
}

function recordEvent({ agent, type, msg }) {
  const llmContext = extractLlmContext(agent)
  const timestamp = msg?.timestamp ?? Date.now()
  agent.customEventAggregator.add([
    { type, timestamp },
    Object.assign({}, msg, llmContext)
  ])
}

function addLlmMeta({ agent, segment, transaction }) {
  agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
  transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  segment.end()
}

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
      summary,
      useNameAsCode: true
    })
    agent.errors.add(transaction, err, llmErrorMessage)
  }
}

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
      embedding: embeddings.length === 1 ? embeddings[0] : undefined,
      useNameAsCode: true
    })
    agent.errors.add(transaction, err, llmErrorMessage)
  }
}

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
 * Bedrock middleware that creates a segment for instrumented bedrock commands
 * and records LLM events on completion. This inlines the behavior
 * of the old shim.record() call.
 *
 * @param {object} subscriber the SmithyClientSendSubscriber instance
 * @param {object} clientConfig AWS client configuration
 * @param {Function} next next middleware function
 * @param {object} context AWS command context
 * @returns {Function} wrapped middleware
 */
function bedrockMiddleware(subscriber, clientConfig, next, context) {
  const { agent, logger } = subscriber
  const { commandName } = context

  if (!INSTRUMENTED_COMMANDS.has(commandName)) {
    logger.debug('Not instrumenting bedrock command %s', commandName)
    return next
  }

  const isConverse = CONVERSE_COMMANDS.has(commandName)

  return async function wrappedBedrockMw(args) {
    const ctx = agent.tracer.getContext()
    const transaction = ctx?.transaction
    const parent = ctx?.segment

    if (!transaction?.isActive() || !parent) {
      logger.debug('Not recording bedrock call, not in an active transaction.')
      return next(args)
    }

    const { input } = args
    const bedrockCommand = new BedrockCommand(input)
    const { modelType } = bedrockCommand
    const segmentName = `Llm/${modelType}/Bedrock/${commandName}`

    const segment = agent.tracer.createSegment({
      name: segmentName,
      parent,
      transaction
    })

    if (!segment) {
      logger.debug('Failed to create segment for %s', segmentName)
      return next(args)
    }

    // Bind next to run in the segment's context with full=true so that
    // segment.start() and segment.touch() are handled automatically,
    // and downstream middleware (e.g. HTTP outbound) creates child segments.
    const newCtx = ctx.enterSegment({ segment })
    const boundNext = agent.tracer.bindFunction(next, newCtx, true)

    const afterHook = (err, response) => {
      const passThroughParams = {
        agent,
        logger,
        err,
        response,
        segment,
        transaction,
        bedrockCommand,
        modelType
      }

      if (err && !response) {
        handleResponse(passThroughParams)
      } else if (response.output.body instanceof Uint8Array || 'output' in response.output) {
        handleResponse(passThroughParams)
      } else if (isStreamingEnabled({ commandName, config: agent.config })) {
        if (isConverse) {
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
      } else {
        logger.warn(
          'ai_monitoring.streaming.enabled is set to `false`, stream will not be instrumented.'
        )
        agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
        addLlmMeta({ agent, segment, transaction })
      }
    }

    try {
      const result = await boundNext(args)
      afterHook(null, result)
      return result
    } catch (err) {
      afterHook(err)
      throw err
    }
  }
}

/**
 * Bedrock middleware config:
 *
 * The `init` function is called by `SmithyClientSendSubscriber` to determine
 * if the middleware should be registered. The `middleware` function is the
 * actual middleware added to the AWS client's middleware stack.
 */
module.exports = {
  init(subscriber, data) {
    const { agent, logger } = subscriber
    if (shouldSkipInstrumentation(agent.config)) {
      logger.debug(
        '@aws-sdk/client-bedrock-runtime instrumentation is disabled. To enable set `config.ai_monitoring.enabled` to true'
      )
      return false
    }

    TRACKING_METRIC = `${AI.BEDROCK.TRACKING_PREFIX}/${data.moduleVersion}`
    return true
  },
  fn: bedrockMiddleware,
  config: {
    name: 'NewRelicBedrockMiddleware',
    step: 'deserialize',
    priority: 'high',
    override: true
  }
}
