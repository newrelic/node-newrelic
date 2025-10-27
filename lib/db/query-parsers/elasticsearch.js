/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const logger = require('../../logger').child({ component: 'elasticsearch_query_parser' })
const { isNotEmpty } = require('../../util/objects')

/**
 * Parses the parameters sent to elasticsearch for collection,
 * method, and query
 *
 * @param {object} params Query object received by the datashim.
 * Required properties: path {string}, method {string}.
 * Optional properties: querystring {string}, body {object}, and
 * bulkBody {object}
 * @returns {object} consisting of collection {string}, operation {string},
 * and query {string}
 */
function queryParser(params) {
  params = JSON.parse(params)
  const { collection, operation } = parsePath(params.path, params.method)

  // the substance of the query may be in querystring or in body.
  let queryParam = {}
  if (isNotEmpty(params.querystring)) {
    queryParam = params.querystring
  }
  // let body or bulkBody override querystring, as some requests have both
  if (isNotEmpty(params.body)) {
    queryParam = params.body
  } else if (Array.isArray(params.bulkBody) && params.bulkBody.length) {
    queryParam = params.bulkBody
  }
  // The helper interface provides a simpler API:

  const query = JSON.stringify(queryParam)

  return {
    collection,
    operation,
    query
  }
}

/**
 * Convenience function for parsing the params.path sent to the queryParser
 * for normalized collection and operation
 *
 * @param {string} pathString params.path supplied to the query parser
 * @param {string} method http method called by @elastic/elasticsearch
 * @returns {object} consisting of collection {string} and operation {string}
 */
function parsePath(pathString, method) {
  let collection
  let operation
  const defaultCollection = 'any'
  const actions = {
    GET: 'get',
    PUT: 'create',
    POST: 'create',
    DELETE: 'delete',
    HEAD: 'exists'
  }
  const suffix = actions[method]

  try {
    const path = pathString.split('/')
    if (method === 'PUT' && path.length === 2) {
      collection = path?.[1] || defaultCollection
      operation = 'index.create'
      return { collection, operation }
    }
    for (let idx = 0; idx < path.length; idx++) {
      const segment = path[idx]
      const prev = idx - 1
      if (segment === '_search') {
        collection = path?.[prev] || defaultCollection
        operation = 'search'
      } else if (segment[0] === '_') {
        const opname = segment.substring(1)
        collection = path?.[prev] || defaultCollection
        operation = `${opname}.${suffix}`
      }
    }

    if (!operation && !collection) {
      // likely creating an index--no underscore segments
      collection = path?.[1] || defaultCollection
      operation = `index.${suffix}`
    }
  } catch (e) {
    logger.warn('Failed to parse path for operation and collection. Using defaults')
    logger.warn(e)
    collection = defaultCollection
    operation = 'unknown'
  }

  return { collection, operation }
}

module.exports = { queryParser, parsePath }
