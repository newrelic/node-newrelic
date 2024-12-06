/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * parser used to grab the collection and operation
 * from a running query
 *
 * @param {object} operation mongodb operation
 * @returns {object} { operation, collection } parsed operation and collection
 */
function queryParser(operation) {
  let collection = this.collectionName || 'unknown'

  // cursor methods have collection on namespace.collection
  if (this?.namespace?.collection) {
    collection = this.namespace.collection
    // (un)ordered bulk operations have collection on different key
  } else if (this?.s?.collection?.collectionName) {
    collection = this.s.collection.collectionName
  }

  return { operation, collection }
}

module.exports = queryParser
