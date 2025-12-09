/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const GoogleGenAIGenerateContentSubscriber = require('./generate-content')
const { AI } = require('../../../lib/metrics/names')

class GoogleGenAIGenerateContentStreamSubscriber extends GoogleGenAIGenerateContentSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_generateContentStreamInternal' })
  }

  get enabled() {
    return super.enabled && this.streamingEnabled
  }

  get streamingEnabled() {
    return this.agent.config.ai_monitoring.streaming.enabled
  }

  handler(data, ctx) {
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` or `ai_monitoring.streaming.enabled` is set to false, not creating segment.')
      return ctx
    }

    return super.handler(data, ctx)
  }

  /**
   * Instruments the streaming response by wrapping the next function.
   * @param {object} params function params
   * @param {object} params.request the original request object
   * @param {object} params.response the original response object
   * @param {TraceSegment} params.segment the active trace segment
   * @param {Transaction} params.transaction the active transaction
   */
  instrumentStream({ request, response, segment, transaction }) {
    const self = this
    const originalNext = response.next
    let isDone = false
    let cachedResult = {}
    let err
    let entireMessage = ''
    response.next = async function wrappedNext(...nextArgs) {
      let result = {}
      try {
        result = await originalNext.apply(response, nextArgs)
        // When the stream is done we get {value: undefined, done: true}
        // we need to cache the composed value and add the entire message
        // back in later
        if (result.done === true) {
          isDone = true
        } else {
          cachedResult = result.value
        }

        if (result?.value?.text) {
          entireMessage += result.value.text // readonly variable that equates to result.value.candidates[0].content.parts[0].text
        }
      } catch (streamErr) {
        err = streamErr
        throw err
      } finally {
        // Update segment duration since we want to extend the
        // time it took to handle the stream
        segment.touch()

        // also need to enter this block if there was an
        // error, so we can record it
        if (isDone || err) {
          if (cachedResult?.candidates?.[0]?.content?.parts) {
            cachedResult.candidates[0].content.parts[0].text = entireMessage
          }
          self.recordChatCompletionMessages({
            segment,
            transaction,
            request,
            response: cachedResult,
            err
          })
        }
      }
      return result
    }
  }

  asyncEnd(data) {
    // Check config is ai_monitoring is still enabled
    if (!this.streamingEnabled) {
      this.logger.warn(
        '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
      )
      this.agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
      return
    }
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, not recording Llm events.')
      return
    }

    // Instrument the stream
    const ctx = this.agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { result: response, arguments: args } = data
    const [request] = args

    this.instrumentStream({
      request,
      response,
      segment: ctx.segment,
      transaction: ctx.transaction,
    })

    this.addLlmMeta({
      transaction: ctx.transaction,
      version: data.moduleVersion,
    })
  }
}

module.exports = GoogleGenAIGenerateContentStreamSubscriber
