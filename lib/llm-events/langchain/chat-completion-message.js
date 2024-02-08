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
 */
/**
 * @type {LangChainCompletionMessageParams}
 */
const defaultParams = {
  content: '',
  sequence: 0,
  completionId: makeId(36)
}

class LangChainCompletionMessage extends LangChainEvent {
  content
  sequence
  completion_id

  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    super(params)

    if (params.runId) {
      this.id = `${params.runId}-${params.sequence}`
    } else {
      this.id = `${this.id}-${params.sequence}`
    }

    this.content = params.content
    this.sequence = params.sequence
    this.completion_id = params.completionId
  }
}

module.exports = LangChainCompletionMessage
