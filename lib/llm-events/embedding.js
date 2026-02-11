/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event-base')

/**
 * An event that captures data specific to the creation of an embedding.
 *
 * @augments LlmEvent
 * @property {number} duration Total time taken for the embedding call to complete
 *  in milliseconds
 * @property {string} input Input to the embedding creation call
 * @property {string} request.model Model name specified in the request (e.g. `gpt-4`),
 *  can differ from `this['response.model']`
 * @property {object|undefined} response.headers Vendor-specific headers, if any;
 *  will be assigned to the `LlmEmbedding` like `this['response.headers.key'] = value`
 * @property {string} response.organization Organization ID returned in the response
 *  or request headers
 * @property {number} response.usage.total_tokens Total number of tokens used for
 *  input text
 */
module.exports = class LlmEmbedding extends LlmEvent {
  /**
   * @param {object} params Constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {TraceSegment} params.segment Current segment
   * @param {Transaction} params.transaction Current and active transaction
   * @param {string} [params.requestId] ID associated with the request -
   *    typically available in response headers
   * @param {string} params.requestInput Input to the embedding creation call
   * @param {string} [params.requestModel] Model name specified in the request
   *    (e.g. 'gpt-4')
   * @param {string} [params.responseModel] Model name returned in the response
   *    (can differ from `request.model`)
   * @param {string} [params.responseOrg] Organization ID returned in the response
   *     or response headers
   * @param {string} params.vendor Lowercased name of vendor (e.g. 'openai')
   * @param {boolean} [params.error] Set to `true` if an error occurred during
   *    creation call - omitted if no error occurred
   */
  constructor({ agent, segment, transaction, requestId, requestInput, requestModel, responseModel, responseOrg, vendor, error }) {
    super({ agent, segment, requestId, responseModel, transaction, vendor, error })
    if (requestModel) this['request.model'] = requestModel
    if (responseOrg) this['response.organization'] = responseOrg
    this.duration = segment.getDurationInMillis()

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = requestInput
    }
  }

  /**
   * If `totalTokens` is valid, assigns it to
   * `this['response.usage.total_tokens']`.
   * @param {number} totalTokens total tokens on embedding message
   */
  set totalTokenCount(totalTokens) {
    if (this.isValidTokenCount(totalTokens)) {
      this['response.usage.total_tokens'] = totalTokens
    }
  }

  /**
   * For embeddings, returns `this['response.usage.total_tokens']`.
   *
   * @returns {number|undefined} total token count
   */
  get totalTokenCount() {
    return this['response.usage.total_tokens']
  }
}
