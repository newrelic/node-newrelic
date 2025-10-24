/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const GoogleGenAIGenerateContentSubscriber = require('./generate-content')
const { AI } = require('../../../lib/metrics/names')

class GoogleGenAIGenerateContentStreamSubscriber extends GoogleGenAIGenerateContentSubscriber {
  constructor({ agent, logger, channelName = 'nr_generateContentStreamInternal' }) {
    super({ agent, logger, channelName })
  }

  /**
   * Instruments the streaming response by wrapping the next function.
   * @param {object} params function params
   * @param {object} params.request the original request object
   * @param {object} params.response the original response object
   * @param {TraceSegment} params.segment the active trace segment
   * @param {Transaction} params.transaction the active transaction
   */
  async instrumentStream({ request, response, segment, transaction }) {
    const { agent, logger } = this

    if (!agent.config.ai_monitoring.streaming.enabled) {
      logger.warn(
        '`ai_monitoring.streaming.enabled` is set to `false`, stream will not be instrumented.'
      )
      agent.metrics.getOrCreateMetric(AI.STREAMING_DISABLED).incrementCallCount()
      return
    }

    const originalNext = response.next
    let err
    let content
    let modelVersion
    let finishReason
    let entireMessage = ''
    response.next = async function wrappedNext(...nextArgs) {
      let result = {}
      try {
        result = await originalNext.apply(response, nextArgs)
        if (result?.value?.text) {
          modelVersion = result.value.modelVersion
          content = result.value.candidates[0].content
          entireMessage += result.value.text // readonly variable that equates to result.value.candidates[0].content.parts[0].text
        }
        if (result?.value?.candidates?.[0]?.finishReason) {
          finishReason = result.value.candidates[0].finishReason
        }
      } catch (streamErr) {
        err = streamErr
        throw err
      } finally {
        // Update segment duration since we want to extend the
        // time it took to handle the stream
        segment.touch()

        // result will be {value: undefined, done: true}
        // when the stream is done, so we need to create
        // a mock GenerateContentResponse object with
        // the entire message
        //
        // also need to enter this block if there was an
        // error, so we can record it
        if (result?.done || err) {
          if (content) {
            content.parts[0].text = entireMessage
            result.value = {
              candidates: [
                { content, finishReason }
              ],
              modelVersion
            }
          }

          this.recordChatCompletionMessages({
            segment,
            transaction,
            request,
            response: result?.value,
            err
          })
        }
      }
      return result
    }.bind(this)
  }

  asyncEnd(data) {
    const ctx = this.agent.tracer.getContext()
    if (!ctx?.segment || !ctx?.transaction) {
      return
    }
    const { result: response, arguments: args, error: err } = data
    const [request] = args
    this.instrumentStream({
      request,
      headers: ctx.extras?.headers,
      response,
      segment: ctx.segment,
      transaction: ctx.transaction,
      err
    })

    this.addLlmMeta({
      transaction: ctx.transaction,
      version: data.moduleVersion,
    })
  }
}

module.exports = GoogleGenAIGenerateContentStreamSubscriber
