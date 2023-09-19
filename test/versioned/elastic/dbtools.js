/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function dbTools(client) {
  const createIndex = async (index) => {
    return await client.indices.create({
      index
    })
  }

  const indexExists = async (index) => {
    return await client.indices.exists({
      index
    })
  }

  const documentExists = async (index, id) => {
    return await client.exists({
      id,
      index
    })
  }

  const searchDocument = async (index, title) => {
    return await client.search({
      index,
      query: { fuzzy: { title } }
    })
  }

  const createDocument = async (index, id, document) => {
    return await client.index({
      index,
      id,
      document
    })
  }

  const deleteDocument = async (index, id) => {
    return await client.delete({
      id,
      index
    })
  }

  return {
    createIndex,
    indexExists,
    documentExists,
    searchDocument,
    createDocument,
    deleteDocument
  }
}
