/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LangChainEvent = require('./event')

/**
 * @typedef {object} LangChainCompletionSummaryParams
 * @augments LangChainEventParams
 * @property {string[]|string} [tags] A set of tags applied to the LangChain
 * event. If provided as a simple string, it should be a comma separated value
 * string.
 * @property {object[]} messages The set of messages that were returned as the
 * LangChain result.
 */
/**
 * @type {LangChainCompletionSummaryParams}
 */
const defaultParams = {
  tags: [],
  messages: []
}

class LangChainCompletionSummary extends LangChainEvent {
  duration;
  ['response.number_of_messages'] = 0

  #tags

  constructor(params = defaultParams) {
    params = Object.assign({}, defaultParams, params)
    super(params)
    const { segment } = params

    this.tags = params.tags
    this.duration = segment?.getDurationInMillis()
    this['response.number_of_messages'] = params.messages?.length
  }

  get tags() {
    return this.#tags
  }

  set tags(value) {
    if (Array.isArray(value)) {
      this.#tags = value.join(',')
    } else if (typeof value === 'string') {
      this.#tags = value
    }
  }
}

module.exports = LangChainCompletionSummary
