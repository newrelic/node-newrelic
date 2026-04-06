/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const { addLlmMeta, handleResponse, handleStream, isStreamingEnabled, setTrackingMetric, shouldSkipInstrumentation } = require('./utils')
const { INSTRUMENTED_COMMANDS } = require('./constants')
const {
  BedrockCommand,
} = require('#agentlib/llm-events/aws-bedrock/index.js')
const { AI } = require('#agentlib/metrics/names.js')

/**
 * Bedrock middleware that creates a segment for instrumented bedrock commands
 * and records LLM events on completion. This inlines the behavior
 * of the old shim.record() call.
 *
 * @param {object} subscriber the SmithyClientSendSubscriber instance
 * @param {object} _clientConfig AWS client configuration
 * @param {Function} next next middleware function
 * @param {object} context AWS command context
 * @returns {Function} wrapped middleware
 */
function bedrockMiddleware(subscriber, _clientConfig, next, context) {
  const { agent, logger } = subscriber
  const { commandName } = context

  if (!INSTRUMENTED_COMMANDS.has(commandName)) {
    logger.debug('Not instrumenting bedrock command %s', commandName)
    return next
  }

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

    const newCtx = subscriber.createSegment({
      name: segmentName,
      ctx
    })
    const boundNext = agent.tracer.bindFunction(next, newCtx, true)

    const passThroughParams = {
      agent,
      commandName,
      err: null,
      logger,
      segment: newCtx.segment,
      transaction,
      bedrockCommand,
      modelType
    }

    try {
      const result = await boundNext(args)
      passThroughParams.response = result
      nrAfterHook(passThroughParams)
      return result
    } catch (err) {
      passThroughParams.err = err
      nrAfterHook(passThroughParams)
      throw err
    }
  }
}

/**
 * Function that is run after the next middleware(handler) is called
 * This creates the necessary LLM events and possibly wraps the stream to defer
 * creation of LLM events until stream is ended
 *
 * @param {object} passThroughParams collection of data used by the utilities to create LLM events
 */
function nrAfterHook(passThroughParams) {
  const { agent, commandName, err, logger, response, segment, transaction } = passThroughParams
  if (err && !response) {
    handleResponse(passThroughParams)
  } else if (response.output.body instanceof Uint8Array || 'output' in response.output) {
    handleResponse(passThroughParams)
  } else if (isStreamingEnabled({ commandName, config: agent.config })) {
    handleStream(passThroughParams)
  } else {
    logger.warn(
      'ai_monitoring.streaming.enabled is set to `false`, stream will not be instrumented.'
    )
    agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
    addLlmMeta({ agent, segment, transaction })
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

    setTrackingMetric(`${AI.BEDROCK.TRACKING_PREFIX}/${data.moduleVersion}`)
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
