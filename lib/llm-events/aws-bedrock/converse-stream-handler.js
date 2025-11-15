/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * A stream handler processes a streamed response from the Bedrock API by
 * intercepting each stream event, passing that event unmodified up to the
 * consuming client, and then collecting the information into an "API response"
 * object that satisfies the requirements of {@link BedrockResponse}. Once the
 * stream has reached its end, the handler applies some finalizations to the
 * compiled response object, updates the pass through parameters with the new
 * object, and then invokes the final response handler passed in through
 * `onComplete`.
 */
class ConverseStreamHandler {
  // We have to make most of the properties of this object public so that
  // the at-construction-time attached generator function can access them
  // through the `this` reference. See https://jrfom.com/posts/2023/10/31/js-classes/
  // for details on why this is necessary.

  /**
   * The parameters to pass through to the `onComplete` function once the
   * stream has been processed. The `response` property on this object will
   * be overwritten with the response object that has been compiled by the
   * stream handler.
   */
  passThroughParams

  /**
   * The original async iterable returned from the AWS SDK.
   */
  stream

  /**
   * The New Relic agent's internal trace segment. The `.touch` method will be
   * used to mark the end time of the stream processing.
   */
  segment

  /**
   * For streaming messages, we want to capture the effective message chunks like we would see in the non-streaming API
   */
  observedChunks = []

  stopReason

  /**
   * Represents an API response object as {@link BedrockResponse} expects.
   * It will be updated by the stream handler with information received
   * during processing of the stream. Upon stream completion, this object
   * will replace the `response` property of `passThroughParams`.
   *
   * @type {object}
   */
  response = {
    response: {
      headers: {},
      statusCode: 200
    },
    output: {
      output: {
        message: {

        }
      },
      usage: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null
      }
    }
  }

  /**
   * The function that will be invoked once the stream processing has finished.
   * It will receive `this.passThroughParams` as the only parameter.
   */
  onComplete

  constructor({ stream, passThroughParams, onComplete }) {
    this.passThroughParams = passThroughParams
    this.stream = stream
    this.onComplete = onComplete
    this.segment = passThroughParams.segment
    this.generator = handleConverse
  }

  /**
   * Encodes the output body into a Uint8Array, updates the pass through
   * parameters with the compiled response object, and invokes the response
   * handler. The trace segment is also updated to mark the end of the stream
   * processing and account for the time it took to process the stream within
   * the trace.
   */
  finish() {
    this.passThroughParams.response = this.response
    this.onComplete(this.passThroughParams)

    this.segment.touch()
  }

  /**
   * If the given event is the last event in the stream, update the response
   * headers with the metrics data from the event.
   *
   * @param {object} parsedEvent parsed stream event
   */
  updateHeaders(parsedEvent) {
    this.response.response.headers = {
      'x-amzn-requestid': this.passThroughParams.response.response.headers['x-amzn-requestid']
    }
    delete parsedEvent['amazon-bedrock-invocationMetrics']
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
async function * handleConverse() {
  let activeChunk = null

  try {
    for await (const event of this.stream) {
      yield event
      this.updateHeaders(event)
      if (event.contentBlockStart?.start) {
        // Handles a Content block start event. Tool use only.
        const blockStartData = event.contentBlockStart.start
        if (blockStartData.toolUse) {
          activeChunk = { toolUse: { name: blockStartData.toolUse.name } }
        }
      } else if (event.contentBlockStop) {
        if (activeChunk !== null) {
          this.observedChunks.push(activeChunk)
          activeChunk = null
        }
      } else if (event.contentBlockDelta?.delta) {
        // There are also deltas for tool use (stringified inputs) but we don't currently record them so we just ignore for now
        if (event.contentBlockDelta.delta.text) {
          // It seems like the first streamed chunk does not always start with a contentBlockStart message
          // If the stream starts with a delta, assume the current chunk is text
          if (activeChunk === null) {
            activeChunk = { text: '' }
          }
          activeChunk.text += event.contentBlockDelta.delta.text
        }
      // used in `handleResponse` to determine why the model stopped
      } else if (event.messageStop) {
        this.stopReason = event.messageStop?.stopReason
      // sends token usage info at the end of the stream
      } else if (event.metadata?.usage) {
        this.response.output.usage = event.metadata.usage
      }
    }
  } finally {
    this.response.output.output.message.content = this.observedChunks
    this.finish()
  }
}

module.exports = ConverseStreamHandler
