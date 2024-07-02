/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmError,
  BedrockCommand,
  BedrockResponse,
  StreamHandler
} = require('../../../llm-events/aws-bedrock')

const { DESTINATIONS } = require('../../../config/attribute-filter')
const { AI } = require('../../../metrics/names')
const { RecorderSpec } = require('../../../shim/specs')
const InstrumentationDescriptor = require('../../../instrumentation-descriptor')

let TRACKING_METRIC

/**
 * Helper to determine if we should instrument the bedrock middleware call
 *
 * @param {Object} config agent configuration
 * @returns {boolean} to instrument or not to instrument
 */
function shouldSkipInstrumentation(config) {
  return !config?.ai_monitoring?.enabled === true
}

/**
 * Helper to determine if streaming is enabled
 *
 * @param {object} params to function
 * @param {string} params.commandName name of command
 * @param {object} params.config agent configuration
 * @returns {boolean} if streaming command and `ai_monitoring.streaming.enabled` is truthy
 */
function isStreamingEnabled({ commandName, config }) {
  return (
    commandName === 'InvokeModelWithResponseStreamCommand' &&
    config.ai_monitoring?.streaming?.enabled
  )
}

/**
 * Enqueues a LLM event to the custom event aggregator
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {string} params.type LLM event type
 * @param {object} params.msg LLM event
 */
function recordEvent({ agent, type, msg }) {
  msg.serialize()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

/**
 * Increments the tracking metric and sets the llm attribute on transactions
 *
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {TraceSegment} params.segment active segment
 */
function addLlmMeta({ agent, segment }) {
  agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
  segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  // end segment to get a consistent segment duration
  // for both the LLM events and the segment
  segment.end()
}

/**
 * Creates and enqueues the LlmChatCompletionSummary and
 * LlmChatCompletionMessage events and adds an error to transaction if it
 * exists. It will also assign the request, conversation and messages ids by
 * the response id.
 *
 * @param {object} params function params
 * @param {object} params.agent instance of agent
 * @param {object} params.segment active segment
 * @param {BedrockCommand} params.bedrockCommand parsed input
 * @param {Error|null} params.err error from request if exists
 * @param params.bedrockResponse
 * @param params.shim
 */
function recordChatCompletionMessages({
  agent,
  shim,
  segment,
  bedrockCommand,
  bedrockResponse,
  err
}) {
  if (shouldSkipInstrumentation(agent.config) === true) {
    shim.logger.debug('skipping sending of ai data')
    return
  }

  const summary = new LlmChatCompletionSummary({
    agent,
    bedrockResponse,
    bedrockCommand,
    segment,
    isError: err !== null
  })

  const msg = new LlmChatCompletionMessage({
    agent,
    segment,
    bedrockCommand,
    bedrockResponse,
    index: 0,
    completionId: summary.id
  })
  recordEvent({ agent, type: 'LlmChatCompletionMessage', msg })

  bedrockResponse.completions.forEach((content, index) => {
    const chatCompletionMessage = new LlmChatCompletionMessage({
      agent,
      segment,
      bedrockCommand,
      bedrockResponse,
      isResponse: true,
      index: index + 1,
      content,
      completionId: summary.id
    })
    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: chatCompletionMessage })
  })

  recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: summary })

  if (err) {
    const llmError = new LlmError({ bedrockResponse, err, summary })
    agent.errors.add(segment.transaction, err, llmError)
  }
}

/**
 * Creates and enqueues the LlmEmbedding event and adds an error to transaction
 * if it exists.
 *
 * @param {object} params function params
 * @param {object} params.agent instance of agent
 * @param {object} params.shim current shim instance
 * @param {object} params.segment active segment
 * @param {BedrockCommand} params.bedrockCommand parsed input
 * @param {Error|null} params.err error from request if exists
 * @param params.bedrockResponse
 */
function recordEmbeddingMessage({ agent, shim, segment, bedrockCommand, bedrockResponse, err }) {
  if (shouldSkipInstrumentation(agent.config) === true) {
    shim.logger.debug('skipping sending of ai data')
    return
  }

  const embedding = new LlmEmbedding({
    agent,
    segment,
    bedrockCommand,
    bedrockResponse,
    isError: err !== null
  })

  recordEvent({ agent, type: 'LlmEmbedding', msg: embedding })
  if (err) {
    const llmError = new LlmError({ bedrockResponse, err, embedding })
    agent.errors.add(segment.transaction, err, llmError)
  }
}

/**
 * Creates and instance of BedrockResponse
 *
 * @param {object} params function params
 * @param {BedrockCommand} params.bedrockCommand parsed input
 * @param {object} params.response response from bedrock
 * @param {Error|null} params.err error from request if exists
 *
 * @returns {BedrockResponse} parsed response from bedrock
 */
function createBedrockResponse({ bedrockCommand, response, err }) {
  let bedrockResponse

  if (err) {
    bedrockResponse = new BedrockResponse({ bedrockCommand, response: err, isError: err !== null })
  } else {
    bedrockResponse = new BedrockResponse({ bedrockCommand, response })
  }
  return bedrockResponse
}

/**
 * Registers the specification for instrumentation bedrock calls
 *
 * @param {object} params { config, commandName } aws config and command name
 * @param {Shim} _shim instance of shim
 * @param params.commandName
 * @param shim
 * @param {function} _original original middleware function
 * @param {string} _name function name
 * @param {array} args argument passed to middleware
 * @returns {object} specification object that records middleware as promise
 * with an after hook to create LLM events
 */
function getBedrockSpec({ commandName }, shim, _original, _name, args) {
  const { agent } = shim
  const { input } = args[0]
  const bedrockCommand = new BedrockCommand(input)
  const { modelType } = bedrockCommand

  return new RecorderSpec({
    promise: true,
    name: `Llm/${modelType}/Bedrock/${commandName}`,
    after: ({ shim, error: err, result: response, segment }) => {
      const passThroughParams = {
        shim,
        err,
        response,
        segment,
        bedrockCommand,
        modelType
      }

      if (err && !response) {
        handleResponse(passThroughParams)
      } else if (response.output.body instanceof Uint8Array) {
        // non-streamed response
        handleResponse(passThroughParams)
      } else if (isStreamingEnabled({ commandName, config: agent.config })) {
        // stream response
        const handler = new StreamHandler({
          stream: response.output.body,
          onComplete: handleResponse,
          passThroughParams
        })
        response.output.body = handler.generator(handleResponse)
      } else if (!isStreamingEnabled({ commandName, config: agent.config })) {
        shim.logger.warn(
          'ai_monitoring.streaming.enabled is set to `false`, stream will not be instrumented.'
        )
        agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
        addLlmMeta({ agent, segment })
      }
    }
  })
}

function handleResponse({ shim, err, response, segment, bedrockCommand, modelType }) {
  const { agent } = shim
  const bedrockResponse = createBedrockResponse({ bedrockCommand, response, err })

  addLlmMeta({ agent, segment })
  if (modelType === 'completion') {
    recordChatCompletionMessages({
      agent,
      shim,
      segment,
      bedrockCommand,
      bedrockResponse,
      err
    })
  } else if (modelType === 'embedding') {
    recordEmbeddingMessage({
      agent,
      shim,
      segment,
      bedrockCommand,
      bedrockResponse,
      err
    })
  }
}

/**
 * Middleware function that either instruments when InvokeModelCommand or
 * InvokeModelWithResponseStreamCommand or returns existing middleware chain
 *
 * @param {Shim} shim instance of shim
 * @param {object} config AWS configuration object
 * @param {function} next the next middleware function in stack
 * @param {object} context AWS client context info
 */
function bedrockMiddleware(shim, config, next, context) {
  const { commandName } = context
  if (
    commandName === 'InvokeModelCommand' ||
    commandName === 'InvokeModelWithResponseStreamCommand'
  ) {
    return shim.record(next, getBedrockSpec.bind(null, { commandName }))
  }

  shim.logger.debug(`Not instrumenting command ${commandName}`)
  return next
}

module.exports.bedrockMiddlewareConfig = {
  middleware: bedrockMiddleware,
  init(shim) {
    const { agent, logger } = shim
    if (shouldSkipInstrumentation(agent.config)) {
      logger.debug(
        '@aws-sdk/bedrock-runtime-client instrumentation is disabled. To enable set `config.ai_monitoring.enabled` to true'
      )
      return false
    }

    TRACKING_METRIC = `${AI.BEDROCK.TRACKING_PREFIX}/${shim.pkgVersion}`
    return true
  },
  type: InstrumentationDescriptor.TYPE_GENERIC,
  config: {
    name: 'NewRelicBedrockMiddleware',
    step: 'deserialize',
    override: true
  }
}
