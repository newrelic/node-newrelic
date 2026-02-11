/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DESTINATIONS } = require('../config/attribute-filter')
const { makeId } = require('../util/hashes')

/**
 * The base LLM event class that contains logic and properties
 * (e.g. `trace_id`, `vendor`) that are common to all LLM events.
 *
 * Properties are defined as public fields rather than private because
 * these LLM event objects are serialized and then sent via the custom
 * event aggregator.
 * The property names (using snake_case like `trace_id`) must be preserved
 * exactly as-is in the serialized output to match the expected schema.
 *
 * @property {boolean|undefined} error Set to `true` if an error occurred
 *  during creation call, omitted if no error occurred
 * @property {string} id UUID or identifier for the event
 * @property {string} ingest_source Always set to 'Node'
 * @property {string|undefined} request_id ID from request/response headers
 * @property {string|undefined} response.model Model name from response
 * @property {string} span_id GUID of active span
 * @property {string} trace_id Current trace ID
 * @property {string} vendor Lowercased vendor name, e.g. "openai"
 */
module.exports = class EventBase {
  ingest_source = 'Node'

  /**
   * @param {object} params Constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {TraceSegment} params.segment Current segment
   * @param {Transaction} params.transaction Current and active transaction
   * @param {string} params.vendor Lowercase vendor name, e.g. "openai"
   * @param {string} [params.responseModel] Model name from response
   * @param {string} [params.requestId] ID from request/response headers
   * @param {boolean} [params.error] Set to `true` if an error occurred during
   *  creation call, omitted if no error occurred
   */
  constructor({ agent, segment, transaction, vendor, responseModel, requestId, error }) {
    this.id = makeId(32)
    this.span_id = segment.id
    this.trace_id = transaction.traceId
    this.vendor = vendor
    this.metadata = agent

    // The spec says that the `error` property should only be
    // sent (via the collector) if it is set to true.
    if (error === true) {
      this.error = error
    }

    // Like `error`, the spec says that if any other certain attribute value
    // is not accessible via instrumentation (thus `undefined`), it will be
    // omitted from the event.
    if (requestId) this.request_id = requestId
    if (responseModel) this['response.model'] = responseModel
  }

  /**
   * Attaches `llm.` prefixed custom attributes to the LLM event object.
   *
   * @param {Agent} agent New Relic agent instance.
   */
  set metadata(agent) {
    const transaction = agent.tracer.getTransaction()
    const attrs = transaction?.trace?.custom.get(DESTINATIONS.TRANS_SCOPE) || {}
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('llm.')) {
        this[key] = value
      }
    }
  }

  /**
   * Determines if the provided token count is valid.
   * A valid token count is greater than 0 and not null.
   * @param {number} tokenCount The token count obtained from the token callback
   * @returns {boolean} Whether the token count is valid
   */
  isValidTokenCount(tokenCount) {
    return tokenCount !== null && tokenCount > 0
  }

  /**
   * Calculate the token counts using the provided callback.
   * @param {Function} tokenCB The token count callback function.
   * @param {string} model The LLM model ID.
   * @param {string} content The content to calculate tokens for, such as prompt
   *  or completion response.
   * @returns {number|undefined} The calculated token count or undefined if
   *  callback is not a function.
   */
  calculateCallbackTokens(tokenCB, model, content) {
    if (typeof tokenCB === 'function') {
      return tokenCB(model, content)
    }
    return undefined
  }
}
