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
 * @property {string} searchId The UUID to identify the search.
 */
/**
 * @type {LangChainVectorSearchResultParams}
 */

const defaultParams = {
  pageContent: '',
  sequence: 0,
  searchId: crypto.randomUUID()
}

class LangChainVectorSearchResult extends LangChainEvent {
  constructor(params) {
    params = Object.assign({}, defaultParams, params)
    super(params)

    this.page_content = params.pageContent
    this.sequence = params.sequence
    this.search_id = params.searchId
  }
}

module.exports = LangChainVectorSearchResult
