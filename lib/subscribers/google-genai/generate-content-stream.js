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

  /**
   * Instruments the streaming response by wrapping the next function.
   * @param {object} params function params
   * @param {object} params.request the original request object
   * @param {object} params.response the original response object
   * @param {object} params.ctx active context
   */
  instrumentStream({ request, response, ctx }) {
    if (!(ctx?.segment || ctx?.transaction)) {
      this.logger.debug('Empty context, not instrumenting stream')
      return
    }

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
        ctx.segment.touch()

        // also need to enter this block if there was an
        // error, so we can record it
        if (isDone || err) {
          if (cachedResult?.candidates?.[0]?.content?.parts) {
            cachedResult.candidates[0].content.parts[0].text = entireMessage
          }
          self.recordChatCompletionEvents({
            ctx,
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
    // Check config to see if ai_monitoring is still enabled
    if (!this.enabled) {
      this.logger.debug('`ai_monitoring.enabled` is set to false, stream will not be instrumented.')
      return
    }
    if (!this.streamingEnabled) {
      this.logger.warn(
        '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
      )
      this.agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
      return
    }

    // Instrument the stream
    const ctx = this.agent.tracer.getContext()
    const { result: response, arguments: args } = data
    const [request] = args

    this.instrumentStream({
      ctx,
      request,
      response,
    })
  }
}

module.exports = GoogleGenAIGenerateContentStreamSubscriber
