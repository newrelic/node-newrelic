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

    this.page_content = params.pageContent
    this.sequence = params.sequence
  }
}

module.exports = LangChainVectorSearchResult
