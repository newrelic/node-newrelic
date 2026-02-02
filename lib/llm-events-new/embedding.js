/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmEvent = require('./base')

/**
 * An event that captures data specific to the creation of
 * an embedding.
 *
 * @property {string} input Input to the embedding creation call
 * @property {string} request.model Model name specified in the request (e.g. `gpt-4`), can differ from `this.['response.model']`
 * @property {string} response.organization Organization ID returned in the response or request headers
 * @property {number} response.usage.total_tokens Total number of tokens used for input text
 * @property {number} duration Total time taken for the embedding call to complete in milliseconds
 * @property {*} response.headers Vendor-specific headers
 */
class LlmEmbedding extends LlmEvent {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.requestId ID associated with the request - typically available in response headers
   * @param {string} params.requestInput Input to the embedding creation call
   * @param {string} params.requestModel Model name specified in the request (e.g. 'gpt-4')
   * @param {string} params.responseModel Model name returned in the response (can differ from `request.model`)
   * @param {string} params.responseOrg Organization ID returned in the response or response headers
   * @param {string} params.vendor Lowercased name of vendor (e.g. 'openai')
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call - omitted if no error occurred
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
}

module.exports = LlmEmbedding
