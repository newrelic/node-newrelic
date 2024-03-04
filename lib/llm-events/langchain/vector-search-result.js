/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LangChainEvent = require('./event')

/**
 * @typedef {object} LangChainVectorSearchResultParams
 * @augments LangChainEventParams
 * @property {string} pageContent The stringified contents of the pageContent attribute on each returned search result document.
 * @property {number} [sequence=0] The index of the document in the search result documents list.
 * @property {string} search_id The identifier from the LangChainVectorSearch event.
 */
/**
 * @type {LangChainVectorSearchResultParams}
 */
const defaultParams = {
  pageContent: '',
  sequence: 0
}

class LangChainVectorSearchResult extends LangChainEvent {
  constructor(params) {
    params = Object.assign({}, defaultParams, params)
    super(params)

    this.search_id = params.search_id
    this.page_content = params.pageContent
    this.sequence = params.sequence
  }
}

module.exports = LangChainVectorSearchResult
