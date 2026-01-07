/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LangChainEvent = require('./event')
const { makeId } = require('../../util/hashes')

/**
 * @typedef {object} LangChainCompletionMessageParams
 * @augments LangChainEventParams
 * @property {string} content The text of the response received from LangChain.
 * @property {number} [sequence=0] The order of the message in the response.
 * @property {string} [completionId] An identifier for the message.
 * @property {boolean|undefined} [isResponse] Indicates if the completion
 * message represents a response from the remote service.
 */
/**
 * @type {LangChainCompletionMessageParams}
 */
const defaultParams = {
  content: '',
  role: null,
  sequence: 0,
  completionId: makeId(36),
  isResponse: undefined
}

class LangChainCompletionMessage extends LangChainEvent {
  content
  role
  sequence
  completion_id
  is_response

  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    super(params)
    const { agent } = params

    if (params.runId) {
      this.id = `${params.runId}-${params.sequence}`
    } else {
      this.id = `${this.id}-${params.sequence}`
    }

    this.sequence = params.sequence
    this.completion_id = params.completionId
    this.is_response = params.isResponse ?? false
    if (params.role) {
      this.role = params.role
    } else {
      // As a backup, we can infer the role based on if it
      // is a response or not.
      this.role = this.is_response ? 'assistant' : 'user'
    }

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = params.content
    }
  }
}

module.exports = LangChainCompletionMessage
