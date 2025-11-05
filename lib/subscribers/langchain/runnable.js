/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LangchainSubscriber = require('./base')
const {
  AI: { LANGCHAIN }
} = require('../../metrics/names')
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('../../llm-events/langchain/')
const LlmErrorMessage = require('../../llm-events/error-message')
const { DESTINATIONS } = require('../../config/attribute-filter')
const { langchainRunId } = require('../../symbols')

class LangchainRunnableSubscriber extends LangchainSubscriber {
  constructor ({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_invoke' })
    this.events = ['asyncEnd']
  }

  handler(data, ctx) {
    if (!this.enabled) {
      // We need this check inside the wrapper because it is possible for monitoring
      // to be disabled at the account level. In such a case, the value is set
      // after the instrumentation has been initialized.
      return ctx
    }

    const segment = this.agent.tracer.createSegment({
      name: `${LANGCHAIN.CHAIN}/invoke`,
      parent: ctx.segment,
      transaction: ctx.transaction
    })
    return ctx.enterSegment({ segment })
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    const { segment, transaction } = ctx
    if (transaction?.isActive() !== true) {
      return
    }

    const request = data?.arguments?.[0]
    const params = data?.arguments?.[1] || {}
    const { result, error: err, moduleVersion: pkgVersion } = data

    this.recordChatCompletionEvents({
      pkgVersion,
      transaction,
      segment,
      messages: [result],
      events: [request, result],
      metadata: params?.metadata ?? {},
      tags: params?.tags ?? [],
      err
    })
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
    err,
  }) {
    const { agent, logger } = this
    segment.end()

    if (!this.enabled) {
      // We need this check inside the wrapper because it is possible for monitoring
      // to be disabled at the account level. In such a case, the value is set
      // after the instrumentation has been initialized.
      logger.debug('skipping sending of ai data')
      return
    }

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
      transaction
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
   */
  recordCompletions({ events, completionSummary, segment, transaction }) {
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
        completionId: completionSummary.id,
        segment,
        transaction,
        runId: segment[langchainRunId],
        // We call the final output in a LangChain "chain" the "response":
        isResponse: i === events.length - 1
      })

      this.recordEvent({
        type: 'LlmChatCompletionMessage',
        pkgVersion: this.moduleVersion,
        msg: completionMsg
      })
    }
  }
}

module.exports = LangchainRunnableSubscriber
