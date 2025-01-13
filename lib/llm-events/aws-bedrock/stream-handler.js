/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
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
class StreamHandler {
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
      body: {}
    }
  }

  /**
   * The key on the event object that indicates if it is the last event in the
   * stream, and why the stream has ended. If the key is nested, this value
   * should be a dot (.) separated string of keys and indices. For example,
   * if the key is at `event.results[0].reason`, then the value should be
   * `results.0.reason`.
   *
   * @type {string}
   */
  stopReasonKey = ''

  /**
   * Used to decode Uint8Array bodies. There should not be any need to update
   * this property.
   *
   * @type {TextDecoder}
   */
  decoder = new TextDecoder()

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

    const { bedrockCommand } = passThroughParams

    // Each model returns a unique-ish response stream. To handle this, we
    // attach a generator specific to the model that will process the stream
    // events and collect them into `this.response` such that `this.response`
    // ultimately has the shape of a non-streamed response that is expected
    // by BedrockResponse.
    //
    // Important: each of the handler function uses a `try/finally` block
    // to process the original stream. Of particular note is that there is NOT
    // a `catch` block. As of 2024-01-17, we are not able to determine a viable
    // means of inducing an error in the stream such that a `catch` block in
    // our wrapping handler would be hit.
    if (bedrockCommand.isClaude() === true) {
      this.stopReasonKey = 'stop_reason'
      this.generator = handleClaude
    } else if (bedrockCommand.isClaude3() === true) {
      this.stopReasonKey = 'stop_reason'
      this.generator = handleClaude3
    } else if (bedrockCommand.isCohere() === true) {
      this.stopReasonKey = 'generations.0.finish_reason'
      this.generator = handleCohere
    } else if (bedrockCommand.isCohereEmbed() === true) {
      this.stopReasonKey = 'nr_none'
      this.generator = handleCohereEmbed
    } else if (bedrockCommand.isLlama() === true) {
      this.stopReasonKey = 'stop_reason'
      this.generator = handleLlama
    } else if (bedrockCommand.isTitan() === true) {
      this.stopReasonKey = 'completionReason'
      this.generator = handleTitan
    } else {
      // The model doesn't support streaming, or we have not instrumented it.
      this.generator = stream
    }
  }

  /**
   * Encodes the output body into a Uint8Array, updates the pass through
   * parameters with the compiled response object, and invokes the response
   * handler. The trace segment is also updated to mark the end of the stream
   * processing and account for the time it took to process the stream within
   * the trace.
   */
  finish() {
    this.response.output.body = new TextEncoder().encode(JSON.stringify(this.response.output.body))
    this.passThroughParams.response = this.response
    this.onComplete(this.passThroughParams)

    this.segment.touch()
  }

  /**
   * Finds the reason for the end of the stream based upon the model's known
   * stop reason key.
   *
   * @param {object} event
   * @returns {string}
   */
  getStopReason(event) {
    if (this.stopReasonKey.includes('.')) {
      const parts = this.stopReasonKey.split('.')
      let val = event
      for (const p of parts) {
        val = val[p]
      }
      return val
    }

    return event[this.stopReasonKey]
  }

  /**
   * Decodes the Uint8Array that represents a model response.
   *
   * @param {object} event
   *
   * @returns {object}
   */
  parseEvent(event) {
    const json = this.decoder.decode(event.chunk.bytes)
    return JSON.parse(json)
  }

  /**
   * If the given event is the last event in the stream, update the response
   * headers with the metrics data from the event.
   *
   * @param {object} parsedEvent
   */
  updateHeaders(parsedEvent) {
    if (this.getStopReason(parsedEvent) === null) {
      return
    }

    this.response.response.headers = {
      'x-amzn-requestid': this.passThroughParams.response.response.headers['x-amzn-requestid']
    }
    delete parsedEvent['amazon-bedrock-invocationMetrics']
  }
}

async function * handleClaude() {
  let currentBody = {}
  let completion = ''

  try {
    for await (const event of this.stream) {
      yield event
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      currentBody = parsed
      completion += parsed.completion
    }
  } finally {
    currentBody.completion = completion
    this.response.output.body = currentBody
    this.finish()
  }
}

async function * handleClaude3() {
  let currentBody = {}
  let stopReason
  const completions = []

  try {
    for await (const event of this.stream) {
      yield event
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      currentBody = parsed
      if (parsed.type === 'content_block_delta') {
        completions.push(parsed.delta.text)
      } else if (parsed.type === 'message_delta') {
        stopReason = parsed.delta.stop_reason
      }
    }
  } finally {
    currentBody.completions = completions
    currentBody.stop_reason = stopReason
    this.response.output.body = currentBody
    this.finish()
  }
}

async function * handleCohere() {
  let currentBody = {}
  const generations = []
  try {
    for await (const event of this.stream) {
      yield event
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      currentBody = parsed
      Array.prototype.push.apply(generations, parsed.generations)
    }
  } finally {
    currentBody.generations = generations
    this.response.output.body = currentBody
    this.finish()
  }
}

async function * handleCohereEmbed() {
  let currentBody = {}
  const embeddings = []
  try {
    for await (const event of this.stream) {
      yield event
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      currentBody = parsed
      Array.prototype.push.apply(embeddings, parsed.embeddings)
    }
  } finally {
    currentBody.embeddings = embeddings
    this.response.output.body = currentBody
    this.finish()
  }
}

async function * handleLlama() {
  let currentBody = {}
  let generation = ''

  try {
    for await (const event of this.stream) {
      yield event
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      currentBody = parsed
      generation += parsed.generation
    }
  } finally {
    currentBody.generation = generation
    this.response.output.body = currentBody
    this.finish()
  }
}

async function * handleTitan() {
  const body = this.response.output.body
  body.results = []

  try {
    for await (const event of this.stream) {
      yield event // Pass it up to the real consumer of the stream.
      const parsed = this.parseEvent(event)
      this.updateHeaders(parsed)
      body.results.push(parsed)
    }
  } finally {
    this.finish()
  }
}

module.exports = StreamHandler
