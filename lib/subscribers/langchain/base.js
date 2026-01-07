/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('../base')
const { AI: { LANGCHAIN } } = require('../../metrics/names')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('../../llm-events/langchain/')
const LlmErrorMessage = require('../../llm-events/error-message')
const { extractLlmContext } = require('../../util/llm-utils')
const { DESTINATIONS } = require('../../config/attribute-filter')
const { langchainRunId } = require('../../symbols')

class LangchainSubscriber extends Subscriber {
  constructor({ agent, logger, channelName }) {
    super({ agent, logger, channelName, packageName: '@langchain/core' })
    this.events = ['asyncEnd']
  }

  get enabled() {
    return super.enabled && this.agent.config.ai_monitoring.enabled
  }

  /**
   * Ends active segment, creates LlmChatCompletionSummary, and LlmChatCompletionMessage(s), and handles errors if they exists
   *
   * @param {object} params function params
   * @param {TraceSegment} params.segment active segment
   * @param {Array} params.messages response messages
   * @param {Array} params.events prompt and response messages
   * @param {object} params.metadata metadata for the call
   * @param {Array} params.tags tags for the call
   * @param {Error} params.err error object from call
   * @param {Transaction} params.transaction active transaction
   * @param {string} params.pkgVersion module version of langchain
   */
  recordChatCompletionEvents({
    pkgVersion,
    segment,
    transaction,
    messages,
    events,
    metadata,
    tags,
    err
  }) {
    const { agent } = this
    segment.end()

    const completionSummary = new LangChainCompletionSummary({
      agent,
      messages,
      metadata,
      tags,
      segment,
      transaction,
      error: err != null,
      runId: segment[langchainRunId]
    })

    this.recordEvent({
      type: 'LlmChatCompletionSummary',
      pkgVersion,
      msg: completionSummary
    })

    // output can be BaseMessage with a content property https://js.langchain.com/docs/modules/model_io/concepts#messages
    // or an output parser https://js.langchain.com/docs/modules/model_io/concepts#output-parsers
    this.recordCompletions({
      events,
      completionSummary,
      segment,
      transaction,
      pkgVersion
    })

    if (err) {
      agent.errors.add(
        transaction,
        err,
        new LlmErrorMessage({
          response: {},
          cause: err,
          summary: completionSummary
        })
      )
    }

    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
  }

  /**
   * Records the LlmChatCompletionMessage(s)
   *
   * @param {object} params function params
   * @param {Array} params.events prompt and response messages
   * @param {LangChainCompletionSummary} params.completionSummary LlmChatCompletionSummary event
   * @param {TraceSegment} params.segment active segment
   * @param {Transaction} params.transaction active transaction
   * @param {string} params.pkgVersion module version of the LangChain package
   */
  recordCompletions({ events, completionSummary, segment, transaction, pkgVersion }) {
    const { agent, logger } = this
    for (let i = 0; i < events.length; i += 1) {
      let msg = events[i]
      if (msg?.content) {
        msg = msg.content
      }

      let msgString
      try {
        msgString = typeof msg === 'string' ? msg : JSON.stringify(msg)
      } catch (error) {
        logger.error(error, 'Failed to stringify message')
        msgString = ''
      }

      const completionMsg = new LangChainCompletionMessage({
        sequence: i,
        agent,
        content: msgString,
        role: msg?.role,
        completionId: completionSummary.id,
        segment,
        transaction,
        runId: segment[langchainRunId],
        // We call the final output in a LangChain "chain" the "response":
        isResponse: i === events.length - 1
      })

      this.recordEvent({
        type: 'LlmChatCompletionMessage',
        pkgVersion,
        msg: completionMsg
      })
    }
  }

  /**
   * Helper to enqueue a LLM event into the custom event aggregator.  This will also
   * increment the Supportability metric that's used to derive a tag on the APM entity.
   *
   * @param {object} params function params
   * @param {string} params.type type of llm event(i.e.- LlmChatCompletionMessage, LlmTool, etc)
   * @param {object} params.msg the llm event getting enqueued
   * @param {string} params.pkgVersion version of langchain library instrumented
   */
  recordEvent({ type, msg, pkgVersion }) {
    const { agent } = this
    agent.metrics.getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${pkgVersion}`).incrementCallCount()
    const llmContext = extractLlmContext(agent)

    agent.customEventAggregator.add([
      { type, timestamp: Date.now() },
      Object.assign({}, msg, llmContext)
    ])
  }
}

module.exports = LangchainSubscriber
