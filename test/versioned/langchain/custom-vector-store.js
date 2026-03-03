/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * This is a function because we must pass in the appropriate `VectorStore` class
 * from either `langchain-openai` or `langchain-aws`.
 *
 * @param {VectorStore} VectorStore class from `@langchain/core/vectorstore`
 * @returns {object} CustomVectorStore to be used for testing
 */
module.exports = function createCustomVectorStore(VectorStore) {
  class CustomVectorStore extends VectorStore {
    /**
     * @param {object} embeddings Embedding function or object (required by VectorStore)
     * @param {object} [options] Optional config
     */
    constructor(embeddings, options = {}) {
      super(embeddings, options)
      this._documents = []
    }

    _vectorstoreType() {
      return 'custom'
    }

    /**
     * Add documents to the vectorstore without generating real embeddings.
     * @param {Array<{pageContent: string, metadata?: object}>} docs documents to add
     */
    async addDocuments(docs) {
      this._documents.push(...docs)
    }

    /**
     * Perform an in-memory similarity search over stored documents.
     * Called by the base class `similaritySearch` after embedding the query.
     * @param {number[]} _vector unused vector prop
     * @param {number} k score
     * @param {object} [filter] filter query
     * @returns {Array} results from query
     */
    async similaritySearchVectorWithScore(_vector, k, filter) {
      let docs = this._documents
      if (filter) {
        docs = docs.filter((doc) => Object.entries(filter).every(([key, value]) => doc.metadata?.[key] === value))
      }
      return docs.slice(0, k).map((doc) => [doc, 1.0])
    }
  }
  return CustomVectorStore
}
