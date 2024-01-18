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
  LlmTrackedIds,
  BedrockCommand,
  BedrockResponse,
  StreamHandler
} = require('../llm')

const { DESTINATIONS } = require('../util')

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
 * Enqueues a LLM event to the custom event aggregator
 * @param {object} params input params
 * @param {Agent} params.agent NR agent instance
 * @param {string} params.type LLM event type
 * @param {object} params.msg LLM event
 */
function recordEvent({ agent, type, msg }) {
  agent.metrics.getOrCreateMetric(TRACKING_METRIC).incrementCallCount()
  msg.serialize()
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

/**
 * Assigns requestId, conversationId and messageIds for a given
 * chat completion response on the active transaction.
 * This is used for generating LlmFeedbackEvent via `api.recordLlmFeedbackEvent`
 *
 * @param {object} params input params
 * @param {Transaction} params.tx active transaction
 * @param {LlmChatCompletionMessage} params.msg chat completion message
 * @param {string} params.responseId id of response
 */
function assignIdsToTx({ tx, msg, responseId }) {
  const tracker = tx.llm.responses
  const trackedIds =
    tracker.get(responseId) ??
    new LlmTrackedIds({
      requestId: msg.request_id,
      conversationId: msg.conversation_id
    })
  trackedIds.message_ids.push(msg.id)
  tracker.set(responseId, trackedIds)
}

/**
 * Creates and enqueues the LlmChatCompletionSummary and n LlmChatCompletionMessage events and adds an error to transaction if it exists. It will also assign the request, conversation and messages ids by the response id
 *
 * @param {object} params function params
 * @param {object} params.agent instance of agent
 * @param {object} params.credentials aws resolved credentials
 * @param {object} params.segment active segment
 * @param {BedrockCommand} params.bedrockCommand parsed input
 * @param {Error|null} params.err error from request if exists
 */
function recordChatCompletionMessages({
  agent,
  credentials,
  segment,
  bedrockCommand,
  bedrockResponse,
  err
}) {
  const tx = segment.transaction
  const summary = new LlmChatCompletionSummary({
    credentials,
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
  assignIdsToTx({ tx, responseId: bedrockResponse.requestId, msg })
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
    assignIdsToTx({ tx, responseId: bedrockResponse.requestId, msg: chatCompletionMessage })
    recordEvent({ agent, type: 'LlmChatCompletionMessage', msg: chatCompletionMessage })
  })

  recordEvent({ agent, type: 'LlmChatCompletionSummary', msg: summary })

  if (err) {
    const llmError = new LlmError({ bedrockResponse, err, summary })
    agent.errors.add(segment.transaction, err, llmError)
  }
}

/**
 * Creates and enqueues the LlmEmbedding event and adds an error to transaction if it exists
 *
 * @param {object} params function params
 * @param {object} params.agent instance of agent
 * @param {object} params.credentials aws resolved credentials
 * @param {object} params.segment active segment
 * @param {BedrockCommand} params.bedrockCommand parsed input
 * @param {Error|null} params.err error from request if exists
 */
function recordEmbeddingMessage({
  agent,
  credentials,
  segment,
  bedrockCommand,
  bedrockResponse,
  err
}) {
  const embedding = new LlmEmbedding({
    agent,
    credentials,
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
 * @param {function} _original original middleware function
 * @param {string} _name function name
 * @param {array} args argument passed to middleware
 * @returns {object} specification object that records middleware as promise
 * with an after hook to create LLM events
 */
function getBedrockSpec({ config, commandName }, _shim, _original, _name, args) {
  const { input } = args[0]
  const bedrockCommand = new BedrockCommand(input)
  const { modelType } = bedrockCommand

  /** 🚨 Code Smell 🚨
   * spec functions cannot be async, nor can after hooks.
   * this works due to the nature of the event loop.
   * the promise resolves before the after hook fires.
   */
  let credentials = null
  config.credentials().then((creds) => {
    credentials = creds
  })
  return {
    promise: true,
    name: `Llm/${modelType}/Bedrock/${commandName}`,
    // eslint-disable-next-line max-params
    after: (shim, _fn, _fnName, err, response, segment) => {
      const passThroughParams = {
        shim,
        err,
        response,
        segment,
        credentials,
        bedrockCommand,
        modelType
      }

      if (err && !response) {
        handleResponse(passThroughParams)
      } else if (response.output.body instanceof Uint8Array) {
        // non-streamed response
        handleResponse(passThroughParams)
      } else {
        // stream response
        const handler = new StreamHandler({
          stream: response.output.body,
          onComplete: handleResponse,
          passThroughParams
        })
        response.output.body = handler.generator(handleResponse)
      }
    }
  }
}

function handleResponse({ shim, err, response, segment, credentials, bedrockCommand, modelType }) {
  const { agent } = shim
  const bedrockResponse = createBedrockResponse({ bedrockCommand, response, err })

  segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  // end segment to get a consistent segment duration
  // for both the LLM events and the segment
  segment.end()

  if (modelType === 'completion') {
    recordChatCompletionMessages({
      agent,
      credentials,
      segment,
      bedrockCommand,
      bedrockResponse,
      err
    })
  } else if (modelType === 'embedding') {
    recordEmbeddingMessage({
      agent,
      credentials,
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
    return shim.record(next, getBedrockSpec.bind(null, { config, commandName }))
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

    TRACKING_METRIC = `Nodejs/ML/Bedrock/${shim.pkgVersion}`
    return true
  },
  type: 'generic',
  config: {
    name: 'NewRelicBedrockMiddleware',
    step: 'deserialize'
  }
}
