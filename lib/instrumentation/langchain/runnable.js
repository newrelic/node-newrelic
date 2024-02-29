/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./common')
const { AI } = require('../../metrics/names')
const { LANGCHAIN } = AI
const {
  LangChainCompletionMessage,
  LangChainCompletionSummary
} = require('../../llm-events/langchain/')
const LlmErrorMessage = require('../../llm-events/error-message')
const { DESTINATIONS } = require('../../config/attribute-filter')
const { langchainRunId } = require('../../symbols')
const { RecorderSpec } = require('../../shim/specs')

module.exports = function initialize(shim, langchain) {
  const { agent, pkgVersion } = shim

  if (common.shouldSkipInstrumentation(agent.config)) {
    shim.logger.debug(
      'langchain instrumentation is disabled.  To enable set `config.ai_monitoring.enabled` to true'
    )
    return
  }

  instrumentInvokeChain({ langchain, shim })

  if (agent.config.ai_monitoring.streaming.enabled) {
    instrumentStream({ langchain, shim })
  } else {
    shim.logger.warn(
      '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
    )
    agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
    agent.metrics
      .getOrCreateMetric(`${LANGCHAIN.TRACKING_PREFIX}/${pkgVersion}`)
      .incrementCallCount()
  }
}

/**
 * Instruments and records span and relevant LLM events for `chain.invoke`
 *
 * @param {object} params function params
 * @param {object} params.langchain `@langchain/core/runnables/base` export
 * @param {Shim} params.shim instace of shim
 */
function instrumentInvokeChain({ langchain, shim }) {
  shim.record(
    langchain.RunnableSequence.prototype,
    'invoke',
    function wrapCall(shim, _invoke, fnName, args) {
      const [request, params] = args
      const metadata = params?.metadata ?? {}
      const tags = params?.tags ?? []

      return new RecorderSpec({
        name: `${LANGCHAIN.CHAIN}/${fnName}`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, output, segment) {
          recordChatCompletionEvents({
            segment,
            messages: [output],
            events: [request, output],
            metadata,
            tags,
            err,
            shim
          })
        }
      })
    }
  )
}

/**
 * Instruments and records span and relevant LLM events for `chain.stream`
 *
 * @param {object} params function params
 * @param {object} params.langchain `@langchain/core/runnables/base` export
 * @param {Shim} params.shim instace of shim
 */
function instrumentStream({ langchain, shim }) {
  shim.record(
    langchain.RunnableSequence.prototype,
    'stream',
    function wrapStream(shim, _stream, fnName, args) {
      const [request, params] = args
      const metadata = params?.metadata ?? {}
      const tags = params?.tags ?? []

      return new RecorderSpec({
        name: `${LANGCHAIN.CHAIN}/${fnName}`,
        promise: true,
        // eslint-disable-next-line max-params
        after(_shim, _fn, _name, err, output, segment) {
          // Input error occurred which means a stream was not created.
          // Skip instrumenting streaming and create Llm Events from
          // the data we have
          if (output?.next) {
            wrapNextHandler({ shim, output, segment, request, metadata, tags })
          } else {
            recordChatCompletionEvents({
              segment,
              messages: [],
              events: [request],
              metadata,
              tags,
              err,
              shim
            })
          }
        }
      })
    }
  )
}

/**
 * Wraps the next method on the IterableReadableStream. It will also record the Llm
 * events when the stream is done processing.
 *
 * @param {object} params function params
 * @param {Shim} params.shim shim instance
 * @param {TraceSegment} params.segment active segment
 * @param {function} params.output IterableReadableStream
 * @param {string} params.request the prompt message
 * @param {object} params.metadata metadata for the call
 * @param {Array} params.tags tags for the call
 */
function wrapNextHandler({ shim, output, segment, request, metadata, tags }) {
  shim.wrap(output, 'next', function wrapIterator(shim, orig) {
    let content = ''
    return async function wrappedIterator() {
      try {
        const result = await orig.apply(this, arguments)
        // only create Llm events when stream iteration is done
        if (result?.done) {
          recordChatCompletionEvents({
            segment,
            messages: [content],
            events: [request, content],
            metadata,
            tags,
            shim
          })
        } else {
          content += result.value
        }
        return result
      } catch (error) {
        recordChatCompletionEvents({
          segment,
          messages: [content],
          events: [request, content],
          metadata,
          tags,
          err: error,
          shim
        })
        throw error
      } finally {
        // update segment duration on every stream iteration to extend
        // the timer
        segment.touch()
      }
    }
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
 * @param {Shim} params.shim shim instance
 */
function recordChatCompletionEvents({ segment, messages, events, metadata, tags, err, shim }) {
  const { pkgVersion, agent } = shim
  segment.end()
  const completionSummary = new LangChainCompletionSummary({
    agent,
    messages,
    metadata,
    tags,
    segment,
    error: err != null,
    runId: segment[langchainRunId]
  })

  common.recordEvent({
    agent,
    type: 'LlmChatCompletionSummary',
    pkgVersion,
    msg: completionSummary
  })

  // output can be BaseMessage with a content property https://js.langchain.com/docs/modules/model_io/concepts#messages
  // or an output parser https://js.langchain.com/docs/modules/model_io/concepts#output-parsers
  recordCompletions({
    events,
    completionSummary,
    agent,
    segment,
    shim
  })

  if (err) {
    agent.errors.add(
      segment.transaction,
      err,
      new LlmErrorMessage({
        response: {},
        cause: err,
        summary: completionSummary
      })
    )
  }

  segment.transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_EVENT, 'llm', true)
}

/**
 * Records the LlmChatCompletionMessage(s)
 *
 * @param {object} params function params
 * @param {Array} params.events prompt and response messages
 * @param {LangChainCompletionSummary} params.completionSummary LlmChatCompletionSummary event
 * @param {Agent} params.agent instance of agent
 * @param {TraceSegment} params.segment active segment
 * @param {Shim} params.shim shim instance
 */
function recordCompletions({ events, completionSummary, agent, segment, shim }) {
  for (let i = 0; i < events.length; i += 1) {
    let msg = events[i]
    if (msg?.content) {
      msg = msg.content
    }

    let msgString
    try {
      msgString = typeof msg === 'string' ? msg : JSON.stringify(msg)
    } catch (error) {
      shim.logger.error(error, 'Failed to stringify message')
      msgString = ''
    }

    const completionMsg = new LangChainCompletionMessage({
      sequence: i,
      agent,
      content: msgString,
      completionId: completionSummary.id,
      segment,
      runId: segment[langchainRunId],
      // We call the final output in a LangChain "chain" the "response":
      isResponse: i === events.length - 1
    })

    common.recordEvent({
      agent,
      type: 'LlmChatCompletionMessage',
      pkgVersion: shim.pkgVersion,
      msg: completionMsg
    })
  }
}
