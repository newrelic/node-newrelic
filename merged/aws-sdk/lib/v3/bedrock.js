/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  LlmChatCompletionMessage,
  LlmChatCompletionSummary,
  LlmEmbedding,
  LlmTrackedIds,
  BedrockCommand,
  BedrockResponse
} = require('../llm')

/**
 * Helper to determine if we should instrument the bedrock middleware call
 *
 * @param {Object} config agent configuration
 * @returns {boolean} to instrument or not to instrument
 */
function shouldSkipInstrumentation(config) {
  return !(
    config?.ai_monitoring?.enabled === true &&
    config?.feature_flag?.aws_bedrock_instrumentation === true
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
  agent.customEventAggregator.add([{ type, timestamp: Date.now() }, msg])
}

/**
 * Assigns requestId, conversationId and messageIds for a given
 * chat completion response on the active transaction.
 * This is used for generating LlmFeedbackEvent via `api.recordLlmFeedbackEvent`
 *
 * @param {object} params input params
 * @param {Transaction} params.tx active transaction
 * @param {LlmChatCompletionMessage} params.completionMsg chat completion message
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
 * Registers the specification for instrumentation bedrock calls
 *
 * @param {object} params { config, commandName } aws config and command name
 * @param {Shim} _shim instance of shim
 * @param {function} _original original middlweare function
 * @param {string} _name function name
 * @param {array} args argument passed to middleware
 * @returns {object} specification object that records middleware as promise with an after hook to create LLM events
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
      const { agent } = shim
      if (err) {
        // TODO: https://github.com/newrelic/node-newrelic-aws-sdk/issues/225
        // i notice with errors the response is null so we may not be able to create
        // useful messages or at the very least make bedrockResponse optional
      }

      segment.end()
      const bedrockResponse = new BedrockResponse({ bedrockCommand, response })

      if (modelType === 'completion') {
        const tx = segment.transaction
        const summary = new LlmChatCompletionSummary({
          credentials,
          agent,
          bedrockResponse,
          bedrockCommand,
          segment
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
      } else if (modelType === 'embedding') {
        const embedding = new LlmEmbedding({
          agent,
          credentials,
          segment,
          bedrockCommand,
          bedrockResponse
        })

        recordEvent({ agent, type: 'LlmEmbedding', msg: embedding })
      }
    }
  }
}

/**
 * Middleware function that either instruments when InvokeModelCommand or InvokeModelWithResponseStreamCommand
 * or returns existing middleware chain
 *
 * @param {Shim} shim instance of shim
 * @param {object} config AWS configuration object
 * @param {function} next the next middleware function in stack
 * @param {object} context AWS client context info
 * @param {function} instrumented middleware or original
 */
function bedrockMiddleware(shim, config, next, context) {
  const { commandName } = context
  if (commandName === 'InvokeModelCommand') {
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

    return true
  },
  type: 'generic',
  config: {
    name: 'NewRelicBedrockMiddleware',
    step: 'deserialize'
  }
}
