/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LangChainEvent = require('./event')
const crypto = require('crypto')

/**
 * @typedef {object} LangChainVectorSearchResultParams
 * @augments LangChainEventParams
 * @property {string} pageContent The stringified contents of the pageContent attribute on each returned search result document.
 * @property {number} [sequence=0] The index of the document in the search result documents list.
 */
/**
 * @type {LangChainVectorSearchResultParams}
 */
const defaultParams = {
  pageContent: '',
  sequence: 0
}

class LangChainVectorSearchResult extends LangChainEvent {
  search_id = crypto.randomUUID()

  constructor(params) {
    params = Object.assign({}, defaultParams, params)
    super(params)
    const { agent } = params

    this.sequence = params.sequence

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.page_content = params.pageContent
    }
  }
}

module.exports = LangChainVectorSearchResult
